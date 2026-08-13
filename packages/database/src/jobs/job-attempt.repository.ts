import type { Model } from "sequelize";
import { getJobModels } from "./models.js";
import type {
  FailureCategory,
  JobAttemptEntity,
  JobAttemptResult,
  RetryDecision,
} from "./entities.js";

function toEntity(instance: Model): JobAttemptEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    jobId: json.jobId as string,
    attemptNumber: json.attemptNumber as number,
    startedAt: (json.startedAt as Date).toISOString(),
    finishedAt: json.finishedAt ? (json.finishedAt as Date).toISOString() : null,
    handler: (json.handler as string | null) ?? null,
    result: (json.result as JobAttemptResult | null) ?? null,
    failureCategory: (json.failureCategory as FailureCategory | null) ?? null,
    failureSummary: (json.failureSummary as string | null) ?? null,
    retryDecision: (json.retryDecision as RetryDecision | null) ?? null,
    correlationId: (json.correlationId as string | null) ?? null,
    evidenceReference: (json.evidenceReference as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
  };
}

/** One row per execution attempt — §10's "do not store only the latest attempt." No `update` beyond closing out result fields on the same row (started open, finished closed); never rewrites a prior attempt's own history once closed. */
export class JobAttemptRepository {
  private readonly model = getJobModels().JobAttempt;

  async create(input: {
    jobId: string;
    attemptNumber: number;
    handler?: string | null;
    correlationId?: string | null;
  }): Promise<JobAttemptEntity> {
    const instance = await this.model.create({
      jobId: input.jobId,
      attemptNumber: input.attemptNumber,
      handler: input.handler ?? null,
      correlationId: input.correlationId ?? null,
    });
    return toEntity(instance);
  }

  async close(
    id: string,
    patch: {
      result: JobAttemptResult;
      failureCategory?: FailureCategory | null;
      failureSummary?: string | null;
      retryDecision?: RetryDecision | null;
      evidenceReference?: string | null;
      finishedAt?: Date;
    },
  ): Promise<JobAttemptEntity | null> {
    const instance = await this.model.findByPk(id);
    if (!instance) {
      return null;
    }
    await instance.update({
      result: patch.result,
      failureCategory: patch.failureCategory ?? null,
      failureSummary: patch.failureSummary ?? null,
      retryDecision: patch.retryDecision ?? null,
      evidenceReference: patch.evidenceReference ?? null,
      finishedAt: patch.finishedAt ?? new Date(),
    });
    return toEntity(instance);
  }

  async findByJob(jobId: string): Promise<readonly JobAttemptEntity[]> {
    const rows = await this.model.findAll({
      where: { jobId },
      order: [["attemptNumber", "ASC"]],
    });
    return rows.map(toEntity);
  }
}
