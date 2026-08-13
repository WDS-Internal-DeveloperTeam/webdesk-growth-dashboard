import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type {
  EligibilityDecision,
  RetentionEligibilityService,
} from "./retention-eligibility.service.js";
import {
  RetentionCleanupService,
  type RetentionRecordDeleter,
} from "./retention-cleanup.service.js";

const CANDIDATE = {
  categoryKey: "job-failed-120d",
  resourceType: "jobs",
  resourceId: "job-1",
  anchorDate: new Date("2020-01-01"),
};

function decision(overrides: Partial<EligibilityDecision> = {}): EligibilityDecision {
  return { eligible: true, reasonCode: "eligible", policy: null, activeHold: null, ...overrides };
}

describe("RetentionCleanupService", () => {
  let eligibility: { evaluate: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let service: RetentionCleanupService;

  beforeEach(() => {
    eligibility = { evaluate: vi.fn() };
    auditService = { record: vi.fn() };
    service = new RetentionCleanupService(
      eligibility as unknown as RetentionEligibilityService,
      auditService as unknown as AuditService,
    );
  });

  it("dry_run mode evaluates every candidate but deletes nothing", async () => {
    eligibility.evaluate.mockResolvedValue(decision({ eligible: true }));
    const deleter: RetentionRecordDeleter = { softDelete: vi.fn() };

    const result = await service.run([CANDIDATE], "dry_run", "actor-1", deleter);

    expect(result.evaluated).toBe(1);
    expect(result.eligible).toBe(1);
    expect(result.deleted).toBe(0);
    expect(deleter.softDelete).not.toHaveBeenCalled();
  });

  it("execute mode deletes only eligible candidates", async () => {
    eligibility.evaluate
      .mockResolvedValueOnce(decision({ eligible: true }))
      .mockResolvedValueOnce(decision({ eligible: false, reasonCode: "active_hold" }));
    const deleter: RetentionRecordDeleter = { softDelete: vi.fn() };

    const result = await service.run(
      [CANDIDATE, { ...CANDIDATE, resourceId: "job-2" }],
      "execute",
      "actor-1",
      deleter,
    );

    expect(result.eligible).toBe(1);
    expect(result.deleted).toBe(1);
    expect(deleter.softDelete).toHaveBeenCalledTimes(1);
    expect(deleter.softDelete).toHaveBeenCalledWith(CANDIDATE);
  });

  it("rejects execute mode with no deleter provided", async () => {
    await expect(service.run([CANDIDATE], "execute", "actor-1")).rejects.toThrow(
      /requires a RetentionRecordDeleter/,
    );
  });

  it("records a retention_run audit event with real counts", async () => {
    eligibility.evaluate.mockResolvedValue(decision({ eligible: true }));
    await service.run([CANDIDATE], "dry_run", "actor-1");

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "retention_run",
        actorUserId: "actor-1",
        action: "dry_run",
        afterState: expect.objectContaining({ mode: "dry_run", evaluated: 1, eligible: 1 }),
      }),
    );
  });

  it("names exactly which records were deleted in the audit event, not just aggregate counts", async () => {
    eligibility.evaluate.mockResolvedValue(decision({ eligible: true }));
    const deleter: RetentionRecordDeleter = { softDelete: vi.fn() };

    await service.run([CANDIDATE], "execute", "actor-1", deleter);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        afterState: expect.objectContaining({
          deletedRecords: [
            {
              categoryKey: CANDIDATE.categoryKey,
              resourceType: CANDIDATE.resourceType,
              resourceId: CANDIDATE.resourceId,
            },
          ],
        }),
      }),
    );
  });

  it("still records an audit event for the deletions that already happened, even if a later candidate's deletion throws", async () => {
    eligibility.evaluate.mockResolvedValue(decision({ eligible: true }));
    const deleter: RetentionRecordDeleter = {
      softDelete: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("deletion backend unavailable")),
    };

    await expect(
      service.run(
        [CANDIDATE, { ...CANDIDATE, resourceId: "job-2" }],
        "execute",
        "actor-1",
        deleter,
      ),
    ).rejects.toThrow(/deletion backend unavailable/);

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        afterState: expect.objectContaining({
          evaluated: 1,
          deleted: 1,
          deletedRecords: [
            {
              categoryKey: CANDIDATE.categoryKey,
              resourceType: CANDIDATE.resourceType,
              resourceId: CANDIDATE.resourceId,
            },
          ],
        }),
      }),
    );
  });
});
