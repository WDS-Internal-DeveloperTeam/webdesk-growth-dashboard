import type { JobEntity, JobRepository } from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import { JobRetryService } from "./job-retry.service.js";

const NOW = new Date("2026-08-13T00:00:00.000Z");

function baseJob(overrides: Partial<JobEntity> = {}): JobEntity {
  return {
    id: "job-1",
    jobType: "framework_probe",
    projectId: null,
    resourceType: null,
    resourceId: null,
    requestedByUserId: null,
    status: "failed",
    progress: null,
    currentStep: null,
    idempotencyKey: null,
    retryPolicy: null,
    attemptCount: 1,
    maxAttempts: 3,
    timeoutSeconds: null,
    scheduledAt: null,
    startedAt: null,
    finishedAt: NOW.toISOString(),
    heartbeatAt: null,
    cancellationState: null,
    failureCode: "boom",
    failureCategory: "retryable_transient",
    failureSummary: "connection reset",
    nextRetryAt: null,
    workerIdentity: null,
    correlationId: null,
    retentionCategory: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("JobRetryService", () => {
  let jobs: { findById: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let service: JobRetryService;

  beforeEach(() => {
    jobs = { findById: vi.fn(), update: vi.fn() };
    auditService = { record: vi.fn() };
    service = new JobRetryService(
      jobs as unknown as JobRepository,
      auditService as unknown as AuditService,
    );
  });

  describe("checkEligibility", () => {
    it("is eligible when the job is terminally failed", async () => {
      jobs.findById.mockResolvedValue(baseJob({ status: "failed" }));
      const result = await service.checkEligibility("job-1");
      expect(result).toEqual({ eligible: true, reason: null });
    });

    it("is not eligible when the job is still running", async () => {
      jobs.findById.mockResolvedValue(baseJob({ status: "running" }));
      const result = await service.checkEligibility("job-1");
      expect(result.eligible).toBe(false);
    });

    it("is not eligible when the job doesn't exist", async () => {
      jobs.findById.mockResolvedValue(null);
      const result = await service.checkEligibility("job-1");
      expect(result).toEqual({ eligible: false, reason: "job_not_found" });
    });
  });

  describe("manualRetry", () => {
    it("resets a failed job to queued, clears failure fields, and records an audit event attributing the requester", async () => {
      jobs.findById.mockResolvedValue(baseJob({ status: "failed" }));
      jobs.update.mockResolvedValue(baseJob({ status: "queued", failureCode: null }));

      const result = await service.manualRetry("job-1", "actor-1");

      expect(jobs.update).toHaveBeenCalledWith(
        "job-1",
        expect.objectContaining({
          status: "queued",
          failureCode: null,
          failureCategory: null,
          failureSummary: null,
          nextRetryAt: null,
          cancellationState: null,
        }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "job_retry_requested",
          actorUserId: "actor-1",
          actorType: "human",
          entityType: "job",
          entityId: "job-1",
          action: "manual_retry_requested",
        }),
      );
      expect(result.status).toBe("queued");
    });

    it("rejects retrying a job that is not in a failed state", async () => {
      jobs.findById.mockResolvedValue(baseJob({ status: "running" }));
      await expect(service.manualRetry("job-1", "actor-1")).rejects.toThrow(
        /not eligible for manual retry/,
      );
      expect(jobs.update).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });
  });
});
