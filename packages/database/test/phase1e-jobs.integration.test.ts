import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { JobAttemptRepository, JobRepository } from "../src/jobs/index.js";
import { IdempotencyKeyRepository } from "../src/idempotency/index.js";
import { closeConnection, getConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Phase 1E job-architecture schema (migrations 00020-00022)
 * against a REAL, disposable PostgreSQL database — including the real
 * unique constraints (`job_attempts(job_id, attempt_number)`,
 * `idempotency_keys(scope, idempotency_key)`) and the `jobs.progress`
 * CHECK constraint, none of which unit tests against a mocked repository
 * can prove.
 */
describe("Phase 1E job architecture (real disposable database)", () => {
  const jobs = new JobRepository();
  const attempts = new JobAttemptRepository();
  const idempotencyKeys = new IdempotencyKeyRepository();

  beforeAll(async () => {
    const migrator = buildMigrator();
    await migrator.up();
  });

  afterAll(async () => {
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  });

  describe("JobRepository", () => {
    it("creates a pending job with sensible defaults", async () => {
      const job = await jobs.create({ jobType: "framework_probe" });
      expect(job.status).toBe("pending");
      expect(job.attemptCount).toBe(0);
      expect(job.maxAttempts).toBe(1);
    });

    it("round-trips project_id and correlation_id when provided", async () => {
      const projectId = randomUUID();
      const correlationId = randomUUID();
      const job = await jobs.create({ jobType: "framework_probe", projectId, correlationId });
      expect(job.projectId).toBe(projectId);
      expect(job.correlationId).toBe(correlationId);
    });

    it("updates job fields via a partial patch", async () => {
      const job = await jobs.create({ jobType: "framework_probe" });
      const updated = await jobs.update(job.id, { status: "running", progress: 50 });
      expect(updated?.status).toBe("running");
      expect(updated?.progress).toBe(50);
    });

    it("rejects a progress value outside 0-100 at the database layer", async () => {
      const job = await jobs.create({ jobType: "framework_probe" });
      await expect(jobs.update(job.id, { progress: 150 })).rejects.toThrow();
    });

    it("lists jobs filtered by status", async () => {
      const jobType = `filter-test-${randomUUID()}`;
      const a = await jobs.create({ jobType });
      await jobs.update(a.id, { status: "running" });
      const b = await jobs.create({ jobType });

      const running = await jobs.list({ jobType, status: "running" });
      expect(running.map((j) => j.id)).toEqual([a.id]);
      const pending = await jobs.list({ jobType, status: "pending" });
      expect(pending.map((j) => j.id)).toEqual([b.id]);
    });
  });

  describe("JobAttemptRepository", () => {
    it("stores multiple attempts for the same job, not just the latest", async () => {
      const job = await jobs.create({ jobType: "framework_probe" });
      await attempts.create({ jobId: job.id, attemptNumber: 1 });
      await attempts.create({ jobId: job.id, attemptNumber: 2 });

      const history = await attempts.findByJob(job.id);
      expect(history.map((a) => a.attemptNumber)).toEqual([1, 2]);
    });

    it("closes an attempt with its result and retry decision", async () => {
      const job = await jobs.create({ jobType: "framework_probe" });
      const attempt = await attempts.create({ jobId: job.id, attemptNumber: 1 });
      expect(attempt).not.toBeNull();

      const closed = await attempts.close(attempt!.id, {
        result: "failed",
        failureCategory: "retryable_transient",
        retryDecision: "will_retry",
      });
      expect(closed?.result).toBe("failed");
      expect(closed?.retryDecision).toBe("will_retry");
      expect(closed?.finishedAt).not.toBeNull();
    });

    it("returns null (not a thrown error) for a duplicate attempt_number, backed by the real UNIQUE constraint", async () => {
      const job = await jobs.create({ jobType: "framework_probe" });
      const first = await attempts.create({ jobId: job.id, attemptNumber: 1 });
      expect(first).not.toBeNull();
      const second = await attempts.create({ jobId: job.id, attemptNumber: 1 });
      expect(second).toBeNull();
    });
  });

  describe("IdempotencyKeyRepository", () => {
    it("reserves a fresh (scope, key) pair", async () => {
      const result = await idempotencyKeys.reserve({
        scope: "job:framework_probe",
        idempotencyKey: randomUUID(),
      });
      expect(result.kind).toBe("reserved");
    });

    it("reports in_progress for a concurrent reservation of the same pending key", async () => {
      const key = randomUUID();
      await idempotencyKeys.reserve({ scope: "job:framework_probe", idempotencyKey: key });
      const second = await idempotencyKeys.reserve({
        scope: "job:framework_probe",
        idempotencyKey: key,
      });
      expect(second.kind).toBe("in_progress");
    });

    it("reports duplicate with the original result once the reservation is completed", async () => {
      const key = randomUUID();
      const first = await idempotencyKeys.reserve({
        scope: "job:framework_probe",
        idempotencyKey: key,
      });
      await idempotencyKeys.complete(first.entity.id, "job-abc");

      const second = await idempotencyKeys.reserve({
        scope: "job:framework_probe",
        idempotencyKey: key,
      });
      expect(second.kind).toBe("duplicate");
      expect(second.entity.resultReference).toBe("job-abc");
    });

    it("allows reissuing the same key after it was marked failed", async () => {
      const key = randomUUID();
      const first = await idempotencyKeys.reserve({
        scope: "job:framework_probe",
        idempotencyKey: key,
      });
      await idempotencyKeys.fail(first.entity.id);

      const second = await idempotencyKeys.reserve({
        scope: "job:framework_probe",
        idempotencyKey: key,
      });
      expect(second.kind).toBe("reserved");
    });

    it("allows the same literal key value under two different scopes", async () => {
      const key = randomUUID();
      const a = await idempotencyKeys.reserve({ scope: "job:type-a", idempotencyKey: key });
      const b = await idempotencyKeys.reserve({ scope: "job:type-b", idempotencyKey: key });
      expect(a.kind).toBe("reserved");
      expect(b.kind).toBe("reserved");
    });

    it("lets only one of two concurrent reissue-after-failure callers actually reserve the key", async () => {
      const key = randomUUID();
      const first = await idempotencyKeys.reserve({
        scope: "job:framework_probe",
        idempotencyKey: key,
      });
      await idempotencyKeys.fail(first.entity.id);

      // Two callers race to reissue the same now-failed key at once — the real regression
      // scenario a plain unconditional UPDATE would let both "win".
      const [a, b] = await Promise.all([
        idempotencyKeys.reserve({ scope: "job:framework_probe", idempotencyKey: key }),
        idempotencyKeys.reserve({ scope: "job:framework_probe", idempotencyKey: key }),
      ]);

      const outcomes = [a.kind, b.kind].sort();
      expect(outcomes).toEqual(["in_progress", "reserved"]);
    });
  });
});
