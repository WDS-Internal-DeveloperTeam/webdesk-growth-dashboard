import type {
  RetentionHoldEntity,
  RetentionHoldRepository,
  RetentionPolicyEntity,
  RetentionPolicyRepository,
} from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RetentionEligibilityService } from "./retention-eligibility.service.js";

const NOW = new Date("2026-08-13T00:00:00.000Z");

function policy(overrides: Partial<RetentionPolicyEntity> = {}): RetentionPolicyEntity {
  return {
    id: "policy-1",
    categoryKey: "job-failed-120d",
    displayName: "Failed jobs",
    retentionValue: 120,
    retentionUnit: "days",
    anchor: "finished_at",
    description: null,
    appliesToEntityType: "jobs",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function hold(overrides: Partial<RetentionHoldEntity> = {}): RetentionHoldEntity {
  return {
    id: "hold-1",
    scope: "entity",
    resourceType: "jobs",
    resourceId: "job-1",
    categoryKey: null,
    reasonCategory: "legal",
    reason: "litigation hold",
    createdByUserId: "actor-1",
    approvedByUserId: null,
    startDate: NOW.toISOString(),
    endDate: null,
    status: "active",
    releaseReason: null,
    releasedByUserId: null,
    releasedAt: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("RetentionEligibilityService", () => {
  let policies: { findByCategoryKey: ReturnType<typeof vi.fn> };
  let holds: {
    findActiveForResource: ReturnType<typeof vi.fn>;
    findActiveForCategory: ReturnType<typeof vi.fn>;
  };
  let service: RetentionEligibilityService;

  beforeEach(() => {
    policies = { findByCategoryKey: vi.fn() };
    holds = { findActiveForResource: vi.fn(), findActiveForCategory: vi.fn() };
    service = new RetentionEligibilityService(
      policies as unknown as RetentionPolicyRepository,
      holds as unknown as RetentionHoldRepository,
    );
    holds.findActiveForResource.mockResolvedValue([]);
    holds.findActiveForCategory.mockResolvedValue([]);
  });

  it("returns policy_not_found for an unrecognized category", async () => {
    policies.findByCategoryKey.mockResolvedValue(null);
    const result = await service.evaluate({
      categoryKey: "not-a-real-category",
      resourceType: "jobs",
      resourceId: "job-1",
      anchorDate: new Date("2020-01-01"),
    });
    expect(result).toEqual({
      eligible: false,
      reasonCode: "policy_not_found",
      policy: null,
      activeHold: null,
    });
  });

  it("is eligible once the record is older than the policy threshold, with no hold or dependency", async () => {
    policies.findByCategoryKey.mockResolvedValue(policy());
    const veryOld = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    const result = await service.evaluate({
      categoryKey: "job-failed-120d",
      resourceType: "jobs",
      resourceId: "job-1",
      anchorDate: veryOld,
    });
    expect(result.eligible).toBe(true);
    expect(result.reasonCode).toBe("eligible");
  });

  it("is not yet eligible when the record is younger than the policy threshold", async () => {
    policies.findByCategoryKey.mockResolvedValue(policy());
    const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const result = await service.evaluate({
      categoryKey: "job-failed-120d",
      resourceType: "jobs",
      resourceId: "job-1",
      anchorDate: recent,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe("not_yet_eligible");
  });

  it("correctly converts a years-denominated policy to a day threshold", async () => {
    policies.findByCategoryKey.mockResolvedValue(
      policy({ categoryKey: "audit-7y", retentionValue: 7, retentionUnit: "years" }),
    );
    const sixYearsOld = new Date(Date.now() - 6 * 365 * 24 * 60 * 60 * 1000);
    const result = await service.evaluate({
      categoryKey: "audit-7y",
      resourceType: "audit_events",
      resourceId: "event-1",
      anchorDate: sixYearsOld,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe("not_yet_eligible");
  });

  it("is not eligible when an active entity-scoped hold exists, even past the age threshold", async () => {
    policies.findByCategoryKey.mockResolvedValue(policy());
    holds.findActiveForResource.mockResolvedValue([hold()]);
    const veryOld = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    const result = await service.evaluate({
      categoryKey: "job-failed-120d",
      resourceType: "jobs",
      resourceId: "job-1",
      anchorDate: veryOld,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe("active_hold");
    expect(result.activeHold?.id).toBe("hold-1");
  });

  it("is not eligible when an active category-scoped hold exists", async () => {
    policies.findByCategoryKey.mockResolvedValue(policy());
    holds.findActiveForCategory.mockResolvedValue([
      hold({
        scope: "category",
        resourceType: null,
        resourceId: null,
        categoryKey: "job-failed-120d",
      }),
    ]);
    const veryOld = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    const result = await service.evaluate({
      categoryKey: "job-failed-120d",
      resourceType: "jobs",
      resourceId: "job-1",
      anchorDate: veryOld,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe("active_hold");
  });

  it("is not eligible when the caller reports an active dependency", async () => {
    policies.findByCategoryKey.mockResolvedValue(policy());
    const veryOld = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
    const result = await service.evaluate({
      categoryKey: "job-failed-120d",
      resourceType: "jobs",
      resourceId: "job-1",
      anchorDate: veryOld,
      hasActiveDependency: true,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasonCode).toBe("active_dependency");
  });
});
