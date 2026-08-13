import type { JobEntity, JobRepository } from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import { JobCancellationService } from "./job-cancellation.service.js";

const NOW = new Date("2026-08-13T00:00:00.000Z");

function baseJob(overrides: Partial<JobEntity> = {}): JobEntity {
  return {
    id: "job-1",
    jobType: "framework_probe",
    projectId: null,
    resourceType: null,
    resourceId: null,
    requestedByUserId: null,
    status: "pending",
    progress: null,
    currentStep: null,
    idempotencyKey: null,
    retryPolicy: null,
    attemptCount: 0,
    maxAttempts: 1,
    timeoutSeconds: null,
    scheduledAt: null,
    startedAt: null,
    finishedAt: null,
    heartbeatAt: null,
    cancellationState: null,
    failureCode: null,
    failureCategory: null,
    failureSummary: null,
    nextRetryAt: null,
    workerIdentity: null,
    correlationId: null,
    retentionCategory: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("JobCancellationService", () => {
  let jobs: { findById: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let service: JobCancellationService;

  beforeEach(() => {
    jobs = { findById: vi.fn(), update: vi.fn() };
    auditService = { record: vi.fn() };
    service = new JobCancellationService(
      jobs as unknown as JobRepository,
      auditService as unknown as AuditService,
    );
  });

  it("cancels a not-yet-started, cancellable job immediately and safely", async () => {
    jobs.findById.mockResolvedValue(baseJob({ jobType: "framework_probe", status: "pending" }));
    jobs.update.mockResolvedValue(baseJob({ status: "cancelled" }));

    const result = await service.requestCancellation("job-1", "actor-1");

    expect(jobs.update).toHaveBeenCalledWith(
      "job-1",
      expect.objectContaining({ status: "cancelled", cancellationState: "cancelled_safely" }),
    );
    expect(result.status).toBe("cancelled");
  });

  it("only requests cancellation (does not change status) for a running, cancellable job", async () => {
    jobs.findById.mockResolvedValue(baseJob({ jobType: "framework_probe", status: "running" }));
    jobs.update.mockResolvedValue(baseJob({ status: "running", cancellationState: "requested" }));

    await service.requestCancellation("job-1", "actor-1");

    expect(jobs.update).toHaveBeenCalledWith("job-1", { cancellationState: "requested" });
  });

  it("marks cancellation as failed for a job type that has not declared cancellation capability", async () => {
    jobs.findById.mockResolvedValue(
      baseJob({ jobType: "not_a_cancellable_type", status: "pending" }),
    );
    jobs.update.mockResolvedValue(baseJob({ cancellationState: "failed" }));

    await service.requestCancellation("job-1", "actor-1");

    expect(jobs.update).toHaveBeenCalledWith("job-1", { cancellationState: "failed" });
  });

  it("records an audit event attributing the requester regardless of outcome", async () => {
    jobs.findById.mockResolvedValue(baseJob({ jobType: "framework_probe", status: "pending" }));
    jobs.update.mockResolvedValue(baseJob({ status: "cancelled" }));

    await service.requestCancellation("job-1", "actor-1");

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "job_cancellation_requested",
        actorUserId: "actor-1",
        actorType: "human",
        entityType: "job",
        entityId: "job-1",
        action: "cancellation_requested",
      }),
    );
  });

  it("rejects cancelling a job already in a terminal state", async () => {
    jobs.findById.mockResolvedValue(baseJob({ status: "succeeded" }));
    await expect(service.requestCancellation("job-1", "actor-1")).rejects.toThrow(
      /already in a terminal state/,
    );
    expect(jobs.update).not.toHaveBeenCalled();
  });

  it("rejects cancelling a job that does not exist", async () => {
    jobs.findById.mockResolvedValue(null);
    await expect(service.requestCancellation("job-1", "actor-1")).rejects.toThrow(/not found/);
  });
});
