import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { JobEntity, JobRepository } from "@webdesk/database";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { AuditService } from "../audit/audit.service.js";
import { CANCELLABLE_JOB_TYPES, JOB_REPOSITORY } from "./jobs.constants.js";

const TERMINAL_STATUSES: ReadonlySet<JobEntity["status"]> = new Set([
  "succeeded",
  "failed",
  "cancelled",
  "expired",
]);

/**
 * Cancellation requests (brief §14). A job that hasn't started yet
 * (`pending`/`queued`) can be cancelled immediately and safely — nothing
 * is running to interrupt. A job already `running`/`retrying` can only be
 * *asked*: `cancellation_state` moves to `"requested"`, and a future
 * job-type-specific handler is responsible for acknowledging it (or for
 * `JobService.complete()` marking it `"too_late"` if the job finishes
 * first). §14: "each future job type must explicitly declare cancellation
 * capability" — `CANCELLABLE_JOB_TYPES` is that declaration; a job type
 * not in it fails immediately rather than pretending to accept the
 * request.
 */
@Injectable()
export class JobCancellationService {
  constructor(
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    private readonly auditService: AuditService,
  ) {}

  async requestCancellation(jobId: string, requestedByUserId: string): Promise<JobEntity> {
    const job = await this.jobs.findById(jobId);
    if (!job) {
      throw new BadRequestException(`Job not found: ${jobId}`);
    }
    if (TERMINAL_STATUSES.has(job.status)) {
      throw new BadRequestException(
        `Job ${jobId} is already in a terminal state ("${job.status}") — nothing to cancel`,
      );
    }

    let updated: JobEntity | null;
    if (!CANCELLABLE_JOB_TYPES.has(job.jobType)) {
      updated = await this.jobs.update(jobId, { cancellationState: "failed" });
    } else if (job.status === "pending" || job.status === "queued") {
      updated = await this.jobs.update(jobId, {
        status: "cancelled",
        cancellationState: "cancelled_safely",
        finishedAt: new Date(),
      });
    } else {
      updated = await this.jobs.update(jobId, { cancellationState: "requested" });
    }

    await this.auditService.record({
      eventType: "job_cancellation_requested",
      actorUserId: requestedByUserId,
      actorType: "human",
      entityType: "job",
      entityId: jobId,
      action: "cancellation_requested",
      retentionCategory: "audit-7y",
    });

    // `job` was already confirmed to exist above — `update` cannot legitimately return null here.
    return updated!;
  }
}
