import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  FailureCategory,
  JobAttemptRepository,
  JobEntity,
  JobRepository,
} from "@webdesk/database";
import { JOB_ATTEMPT_REPOSITORY, JOB_REPOSITORY } from "./jobs.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { IdempotencyService } from "./idempotency.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- same reason as IdempotencyService above.
import { AuditService } from "../audit/audit.service.js";

export interface CreateJobInput {
  jobType: string;
  projectId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  requestedByUserId?: string | null;
  idempotencyKey?: string | null;
  maxAttempts?: number;
  timeoutSeconds?: number | null;
  scheduledAt?: Date | null;
  correlationId?: string | null;
  retentionCategory?: string | null;
}

/** §12's failure categories that are automatically retryable — the others require either a fix (validation/authorization) or are already terminal by nature (cancelled). "unknown" is deliberately NOT auto-retried — §12: "do not retry every error blindly." */
const AUTO_RETRYABLE_CATEGORIES: ReadonlySet<FailureCategory> = new Set([
  "retryable_transient",
  "dependency_unavailable",
  "rate_limited",
  "timeout",
]);

const BASE_RETRY_DELAY_SECONDS = 30;
const MAX_RETRY_DELAY_SECONDS = 3600;

/** Exponential backoff, capped — `attemptNumber` is the attempt that just failed (1-indexed). */
function computeNextRetryAt(attemptNumber: number, now: Date): Date {
  const delaySeconds = Math.min(
    BASE_RETRY_DELAY_SECONDS * 2 ** (attemptNumber - 1),
    MAX_RETRY_DELAY_SECONDS,
  );
  return new Date(now.getTime() + delaySeconds * 1000);
}

function requireJob(job: JobEntity | null, jobId: string): JobEntity {
  if (!job) {
    throw new NotFoundException(`Job not found: ${jobId}`);
  }
  return job;
}

/**
 * The operational-job domain service (brief §9/§10/§12) — the only place
 * `jobs`/`job_attempts` state transitions happen, so every future job
 * producer reuses this instead of inventing its own status/retry logic
 * (§4's core rule). No real producer exists yet; this proves the
 * mechanism, same "framework before business modules" pattern as Phase
 * 1D's `PermissionGuard`/"Users/roles" pairing.
 */
@Injectable()
export class JobService {
  constructor(
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    @Inject(JOB_ATTEMPT_REPOSITORY) private readonly attempts: JobAttemptRepository,
    private readonly idempotency: IdempotencyService,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateJobInput): Promise<JobEntity> {
    if (!input.idempotencyKey) {
      const job = await this.jobs.create(input);
      await this.recordJobCreated(job, input);
      return job;
    }

    const scope = `job:${input.jobType}`;
    const reservation = await this.idempotency.reserve({
      scope,
      idempotencyKey: input.idempotencyKey,
      resourceType: input.resourceType ?? null,
      action: "create",
      requesterUserId: input.requestedByUserId ?? null,
    });

    if (reservation.outcome === "conflict") {
      throw new BadRequestException(
        `A request with idempotency key "${input.idempotencyKey}" is already being processed`,
      );
    }
    if (reservation.outcome === "duplicate") {
      const existingJobId = reservation.reservation.resultReference;
      const existing = existingJobId ? await this.jobs.findById(existingJobId) : null;
      if (existing) {
        return existing;
      }
      // The referenced job was somehow not found (shouldn't happen outside test fixtures
      // deliberately exercising this) — fall through and create fresh rather than error out.
    }

    let job: JobEntity;
    try {
      job = await this.jobs.create(input);
    } catch (error) {
      // Un-reserve the key on a genuine creation failure — otherwise it's stuck in "pending"
      // forever and every future request with this idempotency key gets a false "in_progress"
      // with no way to recover short of manual intervention.
      await this.idempotency.fail(reservation.reservation.id);
      throw error;
    }
    await this.idempotency.complete(reservation.reservation.id, job.id);
    await this.recordJobCreated(job, input);
    return job;
  }

  /**
   * `POST /jobs` previously left zero record in the tamper-resistant `audit_events` trail —
   * `jobs.created_at`/`requested_by_user_id` exist on the row itself, but that's mutable
   * application data, not the DB-trigger-enforced-immutable audit table (see
   * `docs/security/threat-model-phase-1e-operational-infrastructure.md`'s Repudiation finding).
   * Only called for a genuinely NEW job — the idempotent-duplicate early return above (an existing
   * job, not a new creation) does not call this.
   */
  private async recordJobCreated(job: JobEntity, input: CreateJobInput): Promise<void> {
    await this.auditService.record({
      eventType: "job_created",
      actorUserId: input.requestedByUserId ?? null,
      actorType: input.requestedByUserId ? "human" : "system",
      entityType: "job",
      entityId: job.id,
      action: "create",
      reason: `jobType:${input.jobType}`,
      correlationId: input.correlationId ?? null,
      retentionCategory: "audit-7y",
    });
  }

  async findById(jobId: string): Promise<JobEntity> {
    return requireJob(await this.jobs.findById(jobId), jobId);
  }

  async list(filter: {
    status?: JobEntity["status"];
    projectId?: string;
    jobType?: string;
    limit?: number;
    offset?: number;
  }): Promise<readonly JobEntity[]> {
    return this.jobs.list(filter);
  }

  async startAttempt(
    jobId: string,
    input: { handler?: string | null; correlationId?: string | null } = {},
  ): Promise<JobEntity> {
    const job = requireJob(await this.jobs.findById(jobId), jobId);
    if (job.status !== "pending" && job.status !== "queued" && job.status !== "retrying") {
      throw new BadRequestException(
        `Job ${jobId} cannot start an attempt from status "${job.status}"`,
      );
    }

    // A job between retry attempts has nothing actively running — the same "not yet started,
    // cancel immediately and safely" case JobCancellationService already handles for
    // pending/queued jobs. Without this check, a cancellation requested while a job sits in
    // "retrying" is silently dropped: the next automatic retry would proceed as if nothing
    // had been asked of it.
    if (job.status === "retrying" && job.cancellationState === "requested") {
      await this.jobs.update(jobId, {
        status: "cancelled",
        cancellationState: "cancelled_safely",
        finishedAt: new Date(),
      });
      throw new BadRequestException(`Job ${jobId} was cancelled before this retry could start`);
    }

    const attemptNumber = job.attemptCount + 1;
    const attempt = await this.attempts.create({
      jobId,
      attemptNumber,
      handler: input.handler ?? null,
      correlationId: input.correlationId ?? job.correlationId,
    });
    if (!attempt) {
      // The real (job_id, attempt_number) UNIQUE constraint caught a concurrent caller that
      // already started this exact attempt — surface it as a clean conflict rather than an
      // unhandled 500.
      throw new BadRequestException(
        `Job ${jobId} attempt ${attemptNumber} is already being started by a concurrent request`,
      );
    }

    const now = new Date();
    const updated = await this.jobs.update(jobId, {
      status: "running",
      attemptCount: attemptNumber,
      startedAt: job.startedAt ? new Date(job.startedAt) : now,
      workerIdentity: input.handler ?? job.workerIdentity,
    });
    return requireJob(updated, jobId);
  }

  async heartbeat(
    jobId: string,
    input: { step?: string | null; progress?: number | null } = {},
  ): Promise<JobEntity> {
    const job = requireJob(await this.jobs.findById(jobId), jobId);
    if (job.status !== "running") {
      throw new BadRequestException(`Job ${jobId} is not running — cannot record a heartbeat`);
    }
    const updated = await this.jobs.update(jobId, {
      heartbeatAt: new Date(),
      currentStep: input.step ?? job.currentStep,
      progress: input.progress ?? job.progress,
    });
    return requireJob(updated, jobId);
  }

  async complete(jobId: string): Promise<JobEntity> {
    const job = requireJob(await this.jobs.findById(jobId), jobId);
    if (job.status !== "running") {
      throw new BadRequestException(`Job ${jobId} cannot complete from status "${job.status}"`);
    }

    await this.closeCurrentAttempt(job, { result: "succeeded" });

    const updated = await this.jobs.update(jobId, {
      status: "succeeded",
      progress: 100,
      finishedAt: new Date(),
      // A cancellation requested while this job was already finishing arrived too late —
      // record that honestly instead of leaving a stale "requested" state on a succeeded job.
      cancellationState: job.cancellationState === "requested" ? "too_late" : job.cancellationState,
    });
    return requireJob(updated, jobId);
  }

  async fail(
    jobId: string,
    input: {
      failureCode?: string | null;
      failureCategory: FailureCategory;
      failureSummary?: string | null;
      evidenceReference?: string | null;
    },
  ): Promise<JobEntity> {
    const job = requireJob(await this.jobs.findById(jobId), jobId);
    if (job.status !== "running") {
      throw new BadRequestException(`Job ${jobId} cannot fail from status "${job.status}"`);
    }

    const now = new Date();
    const autoRetryable = AUTO_RETRYABLE_CATEGORIES.has(input.failureCategory);
    const willRetry = autoRetryable && job.attemptCount < job.maxAttempts;

    const retryDecision = willRetry
      ? "will_retry"
      : input.failureCategory === "cancelled"
        ? "no_retry_cancelled"
        : autoRetryable
          ? "no_retry_max_attempts"
          : "no_retry_permanent";

    await this.closeCurrentAttempt(job, {
      result: "failed",
      failureCategory: input.failureCategory,
      failureSummary: input.failureSummary ?? null,
      retryDecision,
      evidenceReference: input.evidenceReference ?? null,
    });

    const updated = await this.jobs.update(jobId, {
      status: willRetry ? "retrying" : "failed",
      failureCode: input.failureCode ?? null,
      failureCategory: input.failureCategory,
      failureSummary: input.failureSummary ?? null,
      nextRetryAt: willRetry ? computeNextRetryAt(job.attemptCount, now) : null,
      finishedAt: willRetry ? null : now,
      // Same reasoning as complete(): a terminal failure while a cancellation was in flight
      // arrived too late to interrupt anything — record that honestly instead of leaving a
      // stale "requested" state on a job that's now done. Only resolves it on the terminal
      // (!willRetry) path — if the job is about to retry, startAttempt()'s own check is what
      // finalizes a still-pending cancellation, not this.
      cancellationState:
        !willRetry && job.cancellationState === "requested" ? "too_late" : job.cancellationState,
    });
    return requireJob(updated, jobId);
  }

  private async closeCurrentAttempt(
    job: JobEntity,
    patch: Parameters<JobAttemptRepository["close"]>[1],
  ): Promise<void> {
    const jobAttempts = await this.attempts.findByJob(job.id);
    const current = jobAttempts.find((attempt) => attempt.attemptNumber === job.attemptCount);
    if (current) {
      await this.attempts.close(current.id, patch);
    }
  }
}
