import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { JobEntity, JobRepository } from "@webdesk/database";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { AuditService } from "../audit/audit.service.js";
import { JOB_REPOSITORY } from "./jobs.constants.js";

export interface RetryEligibility {
  readonly eligible: boolean;
  readonly reason: string | null;
}

/**
 * Manual retry (brief §13) — RBAC-gated at the controller
 * (`jobs_retry` on `system_settings`); this service only handles
 * eligibility and state transition, then attributes and audits the
 * request. No final retry UI — that belongs to a later module.
 */
@Injectable()
export class JobRetryService {
  constructor(
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    private readonly auditService: AuditService,
  ) {}

  async checkEligibility(jobId: string): Promise<RetryEligibility> {
    const job = await this.jobs.findById(jobId);
    if (!job) {
      return { eligible: false, reason: "job_not_found" };
    }
    if (job.status !== "failed") {
      return { eligible: false, reason: `job is in status "${job.status}", not "failed"` };
    }
    return { eligible: true, reason: null };
  }

  async manualRetry(jobId: string, requestedByUserId: string): Promise<JobEntity> {
    const eligibility = await this.checkEligibility(jobId);
    if (!eligibility.eligible) {
      throw new BadRequestException(
        `Job ${jobId} is not eligible for manual retry: ${eligibility.reason}`,
      );
    }

    const updated = await this.jobs.update(jobId, {
      status: "queued",
      failureCode: null,
      failureCategory: null,
      failureSummary: null,
      nextRetryAt: null,
      cancellationState: null,
    });

    await this.auditService.record({
      eventType: "job_retry_requested",
      actorUserId: requestedByUserId,
      actorType: "human",
      entityType: "job",
      entityId: jobId,
      action: "manual_retry_requested",
      retentionCategory: "audit-7y",
    });

    // `checkEligibility` above already confirmed the job exists — `update` cannot legitimately
    // return null here.
    return updated!;
  }
}
