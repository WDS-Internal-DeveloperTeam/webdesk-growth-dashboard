import type { JobAttemptRepository, JobEntity, JobRepository } from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IdempotencyService } from "./idempotency.service.js";
import type { AuditService } from "../audit/audit.service.js";
import { JobService } from "./job.service.js";

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
    maxAttempts: 3,
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

describe("JobService", () => {
  let jobs: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  let attempts: {
    create: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    findByJob: ReturnType<typeof vi.fn>;
  };
  let idempotency: {
    reserve: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
    fail: ReturnType<typeof vi.fn>;
  };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let service: JobService;

  beforeEach(() => {
    jobs = { create: vi.fn(), findById: vi.fn(), update: vi.fn(), list: vi.fn() };
    attempts = { create: vi.fn(), close: vi.fn(), findByJob: vi.fn() };
    attempts.create.mockResolvedValue({ id: "attempt-1", attemptNumber: 1, jobId: "job-1" });
    idempotency = { reserve: vi.fn(), complete: vi.fn(), fail: vi.fn() };
    auditService = { record: vi.fn() };
    service = new JobService(
      jobs as unknown as JobRepository,
      attempts as unknown as JobAttemptRepository,
      idempotency as unknown as IdempotencyService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a job directly when no idempotency key is given", async () => {
      jobs.create.mockResolvedValue(baseJob());
      const result = await service.create({ jobType: "framework_probe" });
      expect(jobs.create).toHaveBeenCalledOnce();
      expect(idempotency.reserve).not.toHaveBeenCalled();
      expect(result.id).toBe("job-1");
    });

    it("records a job_created audit event for a directly-created job — previously this left zero audit trail", async () => {
      jobs.create.mockResolvedValue(baseJob());
      await service.create({
        jobType: "framework_probe",
        requestedByUserId: "actor-1",
        correlationId: "corr-1",
      });

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "job_created",
          actorUserId: "actor-1",
          actorType: "human",
          entityType: "job",
          entityId: "job-1",
          action: "create",
          correlationId: "corr-1",
          retentionCategory: "audit-7y",
        }),
      );
    });

    it("attributes a job_created audit event to the system actor when no requester is given", async () => {
      jobs.create.mockResolvedValue(baseJob());
      await service.create({ jobType: "framework_probe" });

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ actorUserId: null, actorType: "system" }),
      );
    });

    it("reserves the idempotency key and creates a job on first request", async () => {
      idempotency.reserve.mockResolvedValue({
        outcome: "proceed",
        reservation: { id: "reservation-1" },
      });
      jobs.create.mockResolvedValue(baseJob());

      await service.create({ jobType: "framework_probe", idempotencyKey: "abc" });

      expect(idempotency.reserve).toHaveBeenCalledWith(
        expect.objectContaining({ scope: "job:framework_probe", idempotencyKey: "abc" }),
      );
      expect(jobs.create).toHaveBeenCalledOnce();
      expect(idempotency.complete).toHaveBeenCalledWith("reservation-1", "job-1");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "job_created", entityId: "job-1" }),
      );
    });

    it("returns the existing job on a duplicate idempotent request instead of creating a new one, without a second job_created event", async () => {
      idempotency.reserve.mockResolvedValue({
        outcome: "duplicate",
        reservation: { id: "reservation-1", resultReference: "job-1" },
      });
      jobs.findById.mockResolvedValue(baseJob());

      const result = await service.create({ jobType: "framework_probe", idempotencyKey: "abc" });

      expect(jobs.create).not.toHaveBeenCalled();
      expect(result.id).toBe("job-1");
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it("rejects with a conflict when another request is currently processing the same key", async () => {
      idempotency.reserve.mockResolvedValue({
        outcome: "conflict",
        reservation: { id: "reservation-1" },
      });

      await expect(
        service.create({ jobType: "framework_probe", idempotencyKey: "abc" }),
      ).rejects.toThrow(/already being processed/);
      expect(jobs.create).not.toHaveBeenCalled();
    });

    it("un-reserves the idempotency key instead of leaving it stuck when job creation itself fails", async () => {
      idempotency.reserve.mockResolvedValue({
        outcome: "proceed",
        reservation: { id: "reservation-1" },
      });
      jobs.create.mockRejectedValue(new Error("db exploded"));

      await expect(
        service.create({ jobType: "framework_probe", idempotencyKey: "abc" }),
      ).rejects.toThrow(/db exploded/);

      expect(idempotency.fail).toHaveBeenCalledWith("reservation-1");
      expect(idempotency.complete).not.toHaveBeenCalled();
    });
  });

  describe("startAttempt", () => {
    it("creates the first attempt and moves a pending job to running", async () => {
      jobs.findById.mockResolvedValue(baseJob({ status: "pending", attemptCount: 0 }));
      jobs.update.mockResolvedValue(baseJob({ status: "running", attemptCount: 1 }));

      const result = await service.startAttempt("job-1", { handler: "worker-a" });

      expect(attempts.create).toHaveBeenCalledWith(
        expect.objectContaining({ jobId: "job-1", attemptNumber: 1, handler: "worker-a" }),
      );
      expect(jobs.update).toHaveBeenCalledWith(
        "job-1",
        expect.objectContaining({ status: "running", attemptCount: 1 }),
      );
      expect(result.status).toBe("running");
    });

    it("rejects starting an attempt on a job that is already running", async () => {
      jobs.findById.mockResolvedValue(baseJob({ status: "running" }));
      await expect(service.startAttempt("job-1")).rejects.toThrow(/cannot start an attempt/);
      expect(attempts.create).not.toHaveBeenCalled();
    });

    it("finalizes a pending cancellation instead of starting another retry attempt", async () => {
      jobs.findById.mockResolvedValue(
        baseJob({ status: "retrying", attemptCount: 1, cancellationState: "requested" }),
      );

      await expect(service.startAttempt("job-1")).rejects.toThrow(/was cancelled/);

      expect(attempts.create).not.toHaveBeenCalled();
      expect(jobs.update).toHaveBeenCalledWith(
        "job-1",
        expect.objectContaining({ status: "cancelled", cancellationState: "cancelled_safely" }),
      );
    });

    it("rejects with a conflict, not an unhandled error, when a concurrent caller already started this attempt", async () => {
      jobs.findById.mockResolvedValue(baseJob({ status: "pending", attemptCount: 0 }));
      attempts.create.mockResolvedValue(null);

      await expect(service.startAttempt("job-1")).rejects.toThrow(/concurrent request/);
      expect(jobs.update).not.toHaveBeenCalled();
    });
  });

  describe("heartbeat", () => {
    it("updates progress and step on a running job", async () => {
      jobs.findById.mockResolvedValue(baseJob({ status: "running" }));
      jobs.update.mockResolvedValue(baseJob({ status: "running", progress: 40 }));

      await service.heartbeat("job-1", { step: "downloading", progress: 40 });

      expect(jobs.update).toHaveBeenCalledWith(
        "job-1",
        expect.objectContaining({ currentStep: "downloading", progress: 40 }),
      );
    });

    it("rejects a heartbeat on a job that isn't running", async () => {
      jobs.findById.mockResolvedValue(baseJob({ status: "pending" }));
      await expect(service.heartbeat("job-1")).rejects.toThrow(/not running/);
    });
  });

  describe("complete", () => {
    it("closes the current attempt as succeeded and marks the job succeeded", async () => {
      const running = baseJob({ status: "running", attemptCount: 1 });
      jobs.findById.mockResolvedValue(running);
      attempts.findByJob.mockResolvedValue([{ id: "attempt-1", attemptNumber: 1, jobId: "job-1" }]);
      jobs.update.mockResolvedValue(baseJob({ status: "succeeded", progress: 100 }));

      const result = await service.complete("job-1");

      expect(attempts.close).toHaveBeenCalledWith("attempt-1", { result: "succeeded" });
      expect(jobs.update).toHaveBeenCalledWith(
        "job-1",
        expect.objectContaining({ status: "succeeded", progress: 100 }),
      );
      expect(result.status).toBe("succeeded");
    });

    it("marks a pending cancellation request as too_late when the job finishes first", async () => {
      jobs.findById.mockResolvedValue(
        baseJob({ status: "running", attemptCount: 1, cancellationState: "requested" }),
      );
      attempts.findByJob.mockResolvedValue([{ id: "attempt-1", attemptNumber: 1 }]);
      jobs.update.mockResolvedValue(baseJob({ status: "succeeded" }));

      await service.complete("job-1");

      expect(jobs.update).toHaveBeenCalledWith(
        "job-1",
        expect.objectContaining({ cancellationState: "too_late" }),
      );
    });

    it("rejects completing a job that isn't running", async () => {
      jobs.findById.mockResolvedValue(baseJob({ status: "pending" }));
      await expect(service.complete("job-1")).rejects.toThrow(/cannot complete/);
    });
  });

  describe("fail", () => {
    it("moves to retrying with a computed next_retry_at on a retryable failure with attempts remaining", async () => {
      jobs.findById.mockResolvedValue(
        baseJob({ status: "running", attemptCount: 1, maxAttempts: 3 }),
      );
      attempts.findByJob.mockResolvedValue([{ id: "attempt-1", attemptNumber: 1 }]);
      jobs.update.mockResolvedValue(baseJob({ status: "retrying" }));

      await service.fail("job-1", { failureCategory: "retryable_transient" });

      expect(attempts.close).toHaveBeenCalledWith(
        "attempt-1",
        expect.objectContaining({ result: "failed", retryDecision: "will_retry" }),
      );
      const updateArg = jobs.update.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(updateArg.status).toBe("retrying");
      expect(updateArg.nextRetryAt).toBeInstanceOf(Date);
      expect(updateArg.finishedAt).toBeNull();
    });

    it("terminally fails once max attempts are exhausted, even for a retryable category", async () => {
      jobs.findById.mockResolvedValue(
        baseJob({ status: "running", attemptCount: 3, maxAttempts: 3 }),
      );
      attempts.findByJob.mockResolvedValue([{ id: "attempt-3", attemptNumber: 3 }]);
      jobs.update.mockResolvedValue(baseJob({ status: "failed" }));

      await service.fail("job-1", { failureCategory: "retryable_transient" });

      expect(attempts.close).toHaveBeenCalledWith(
        "attempt-3",
        expect.objectContaining({ retryDecision: "no_retry_max_attempts" }),
      );
      const updateArg = jobs.update.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(updateArg.status).toBe("failed");
      expect(updateArg.nextRetryAt).toBeNull();
    });

    it("terminally fails immediately on a permanent (non-retryable) category, regardless of attempts remaining", async () => {
      jobs.findById.mockResolvedValue(
        baseJob({ status: "running", attemptCount: 1, maxAttempts: 5 }),
      );
      attempts.findByJob.mockResolvedValue([{ id: "attempt-1", attemptNumber: 1 }]);
      jobs.update.mockResolvedValue(baseJob({ status: "failed" }));

      await service.fail("job-1", { failureCategory: "validation" });

      expect(attempts.close).toHaveBeenCalledWith(
        "attempt-1",
        expect.objectContaining({ retryDecision: "no_retry_permanent" }),
      );
      const updateArg = jobs.update.mock.calls[0]?.[1] as Record<string, unknown>;
      expect(updateArg.status).toBe("failed");
    });

    it("rejects failing a job that isn't running", async () => {
      jobs.findById.mockResolvedValue(baseJob({ status: "queued" }));
      await expect(service.fail("job-1", { failureCategory: "unknown" })).rejects.toThrow(
        /cannot fail/,
      );
    });

    it("resolves a pending cancellation to too_late when the job fails terminally", async () => {
      jobs.findById.mockResolvedValue(
        baseJob({
          status: "running",
          attemptCount: 1,
          maxAttempts: 1,
          cancellationState: "requested",
        }),
      );
      attempts.findByJob.mockResolvedValue([{ id: "attempt-1", attemptNumber: 1 }]);
      jobs.update.mockResolvedValue(baseJob({ status: "failed" }));

      await service.fail("job-1", { failureCategory: "validation" });

      expect(jobs.update).toHaveBeenCalledWith(
        "job-1",
        expect.objectContaining({ cancellationState: "too_late" }),
      );
    });

    it("leaves a pending cancellation as requested (not too_late) when the job is about to retry", async () => {
      jobs.findById.mockResolvedValue(
        baseJob({
          status: "running",
          attemptCount: 1,
          maxAttempts: 3,
          cancellationState: "requested",
        }),
      );
      attempts.findByJob.mockResolvedValue([{ id: "attempt-1", attemptNumber: 1 }]);
      jobs.update.mockResolvedValue(baseJob({ status: "retrying" }));

      await service.fail("job-1", { failureCategory: "retryable_transient" });

      expect(jobs.update).toHaveBeenCalledWith(
        "job-1",
        expect.objectContaining({ cancellationState: "requested" }),
      );
    });
  });
});
