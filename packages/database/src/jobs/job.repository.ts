import type { Model } from "sequelize";
import { getJobModels } from "./models.js";
import type { CancellationState, FailureCategory, JobEntity, JobStatus } from "./entities.js";

function toEntity(instance: Model): JobEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    jobType: json.jobType as string,
    projectId: (json.projectId as string | null) ?? null,
    resourceType: (json.resourceType as string | null) ?? null,
    resourceId: (json.resourceId as string | null) ?? null,
    requestedByUserId: (json.requestedByUserId as string | null) ?? null,
    status: json.status as JobStatus,
    progress: (json.progress as number | null) ?? null,
    currentStep: (json.currentStep as string | null) ?? null,
    idempotencyKey: (json.idempotencyKey as string | null) ?? null,
    retryPolicy: (json.retryPolicy as Record<string, unknown> | null) ?? null,
    attemptCount: json.attemptCount as number,
    maxAttempts: json.maxAttempts as number,
    timeoutSeconds: (json.timeoutSeconds as number | null) ?? null,
    scheduledAt: json.scheduledAt ? (json.scheduledAt as Date).toISOString() : null,
    startedAt: json.startedAt ? (json.startedAt as Date).toISOString() : null,
    finishedAt: json.finishedAt ? (json.finishedAt as Date).toISOString() : null,
    heartbeatAt: json.heartbeatAt ? (json.heartbeatAt as Date).toISOString() : null,
    cancellationState: (json.cancellationState as CancellationState | null) ?? null,
    failureCode: (json.failureCode as string | null) ?? null,
    failureCategory: (json.failureCategory as FailureCategory | null) ?? null,
    failureSummary: (json.failureSummary as string | null) ?? null,
    nextRetryAt: json.nextRetryAt ? (json.nextRetryAt as Date).toISOString() : null,
    workerIdentity: (json.workerIdentity as string | null) ?? null,
    correlationId: (json.correlationId as string | null) ?? null,
    retentionCategory: (json.retentionCategory as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/**
 * Pure persistence — no state-machine/transition validation here. That
 * lives in `apps/dashboard-api/src/jobs/job.service.ts`, mirroring the
 * repository/service split already established by `AuditEventRepository`/
 * `AuditService` and `RolePermissionRepository`/`AuthorizationService`.
 */
export class JobRepository {
  private readonly model = getJobModels().Job;

  async create(input: {
    jobType: string;
    projectId?: string | null;
    resourceType?: string | null;
    resourceId?: string | null;
    requestedByUserId?: string | null;
    idempotencyKey?: string | null;
    retryPolicy?: Record<string, unknown> | null;
    maxAttempts?: number;
    timeoutSeconds?: number | null;
    scheduledAt?: Date | null;
    correlationId?: string | null;
    retentionCategory?: string | null;
  }): Promise<JobEntity> {
    const instance = await this.model.create({
      jobType: input.jobType,
      projectId: input.projectId ?? null,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      requestedByUserId: input.requestedByUserId ?? null,
      status: "pending",
      idempotencyKey: input.idempotencyKey ?? null,
      retryPolicy: input.retryPolicy ?? null,
      attemptCount: 0,
      maxAttempts: input.maxAttempts ?? 1,
      timeoutSeconds: input.timeoutSeconds ?? null,
      scheduledAt: input.scheduledAt ?? null,
      correlationId: input.correlationId ?? null,
      retentionCategory: input.retentionCategory ?? null,
    });
    return toEntity(instance);
  }

  async findById(id: string): Promise<JobEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntity(instance) : null;
  }

  /** Generic partial update — the state-machine layer decides which fields change for a given transition. */
  async update(
    id: string,
    patch: Partial<{
      status: JobStatus;
      progress: number | null;
      currentStep: string | null;
      attemptCount: number;
      startedAt: Date | null;
      finishedAt: Date | null;
      heartbeatAt: Date | null;
      cancellationState: CancellationState | null;
      failureCode: string | null;
      failureCategory: FailureCategory | null;
      failureSummary: string | null;
      nextRetryAt: Date | null;
      workerIdentity: string | null;
    }>,
  ): Promise<JobEntity | null> {
    const instance = await this.model.findByPk(id);
    if (!instance) {
      return null;
    }
    await instance.update(patch);
    return toEntity(instance);
  }

  async list(filter: {
    status?: JobStatus;
    projectId?: string;
    jobType?: string;
    limit?: number;
    offset?: number;
  }): Promise<readonly JobEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.projectId) {
      where.projectId = filter.projectId;
    }
    if (filter.jobType) {
      where.jobType = filter.jobType;
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map(toEntity);
  }
}
