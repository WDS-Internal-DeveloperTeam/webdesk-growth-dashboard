import type {
  IncidentSeverityPolicyEntity,
  IncidentSeverityPolicyRepository,
} from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IncidentSeverityService } from "./incident-severity.service.js";

const NOW = new Date("2026-08-13T00:00:00.000Z");

function policy(
  overrides: Partial<IncidentSeverityPolicyEntity> = {},
): IncidentSeverityPolicyEntity {
  return {
    id: "policy-1",
    severity: "critical",
    responseTargetValue: 15,
    responseTargetUnit: "minutes",
    responseTargetDescription: "15 minutes",
    isFixedDuration: true,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("IncidentSeverityService", () => {
  let policies: { findBySeverity: ReturnType<typeof vi.fn>; listAll: ReturnType<typeof vi.fn> };
  let service: IncidentSeverityService;

  beforeEach(() => {
    policies = { findBySeverity: vi.fn(), listAll: vi.fn() };
    service = new IncidentSeverityService(policies as unknown as IncidentSeverityPolicyRepository);
  });

  it("returns policy_not_found for an unrecognized severity", async () => {
    policies.findBySeverity.mockResolvedValue(null);
    const result = await service.evaluateResponseTarget(
      "critical",
      new Date(NOW.getTime() - 1000),
      NOW,
    );
    expect(result).toEqual({
      applicable: false,
      met: null,
      reasonCode: "policy_not_found",
      policy: null,
      elapsedMs: null,
      thresholdMs: null,
    });
  });

  it("evaluates a met response target within the minutes threshold", async () => {
    policies.findBySeverity.mockResolvedValue(
      policy({ responseTargetValue: 15, responseTargetUnit: "minutes" }),
    );
    const openedAt = new Date(NOW.getTime() - 5 * 60 * 1000); // 5 minutes ago
    const result = await service.evaluateResponseTarget("critical", openedAt, NOW);
    expect(result.applicable).toBe(true);
    expect(result.met).toBe(true);
  });

  it("evaluates a missed response target beyond the minutes threshold", async () => {
    policies.findBySeverity.mockResolvedValue(
      policy({ responseTargetValue: 15, responseTargetUnit: "minutes" }),
    );
    const openedAt = new Date(NOW.getTime() - 30 * 60 * 1000); // 30 minutes ago
    const result = await service.evaluateResponseTarget("critical", openedAt, NOW);
    expect(result.applicable).toBe(true);
    expect(result.met).toBe(false);
  });

  it("evaluates an hours-denominated target correctly", async () => {
    policies.findBySeverity.mockResolvedValue(
      policy({ severity: "high", responseTargetValue: 1, responseTargetUnit: "hours" }),
    );
    const openedAt = new Date(NOW.getTime() - 30 * 60 * 1000); // 30 minutes ago — within 1 hour
    const result = await service.evaluateResponseTarget("high", openedAt, NOW);
    expect(result.met).toBe(true);
  });

  it("evaluates a business-days-denominated target by counting weekdays, not raw hours", async () => {
    policies.findBySeverity.mockResolvedValue(
      policy({ severity: "medium", responseTargetValue: 1, responseTargetUnit: "business_days" }),
    );
    // 2026-08-13 is a Thursday; 1 business day later lands on Friday 2026-08-14.
    const openedAt = new Date("2026-08-13T00:00:00.000Z");
    const withinTarget = new Date("2026-08-14T12:00:00.000Z");
    const result = await service.evaluateResponseTarget("medium", openedAt, withinTarget);
    expect(result.applicable).toBe(true);
    expect(result.met).toBe(true);
  });

  it("does not overcount a business day for a partial day past a whole-day boundary", async () => {
    policies.findBySeverity.mockResolvedValue(
      policy({ severity: "medium", responseTargetValue: 1, responseTargetUnit: "business_days" }),
    );
    // Opened Friday 09:00, evaluated Monday 09:01 — just over exactly 3 calendar days later.
    // Only 1 whole business day (Monday) has actually elapsed. A cursor-vs-`to` comparison that
    // rounds the trailing partial day UP (the pre-fix bug) would count Monday AND Tuesday,
    // incorrectly reporting the 1-business-day target as missed.
    const openedAt = new Date("2026-08-14T09:00:00.000Z");
    const evaluatedAt = new Date("2026-08-17T09:01:00.000Z");
    const result = await service.evaluateResponseTarget("medium", openedAt, evaluatedAt);
    expect(result.applicable).toBe(true);
    expect(result.met).toBe(true);
  });

  it("counts zero business days elapsed within the same calendar day", async () => {
    policies.findBySeverity.mockResolvedValue(
      policy({ severity: "medium", responseTargetValue: 0, responseTargetUnit: "business_days" }),
    );
    const openedAt = new Date("2026-08-13T09:00:00.000Z"); // Thursday
    const evaluatedAt = new Date("2026-08-13T17:00:00.000Z"); // same Thursday, 8 hours later
    const result = await service.evaluateResponseTarget("medium", openedAt, evaluatedAt);
    expect(result.applicable).toBe(true);
    expect(result.met).toBe(true); // 0 whole business days elapsed <= 0 target
  });

  it("returns not_a_fixed_duration_target for low — never fabricates a duration that was never approved", async () => {
    policies.findBySeverity.mockResolvedValue(
      policy({
        severity: "low",
        responseTargetValue: null,
        responseTargetUnit: null,
        responseTargetDescription: "Scheduled maintenance — no fixed response-time SLA",
        isFixedDuration: false,
      }),
    );
    const result = await service.evaluateResponseTarget("low", new Date(NOW.getTime() - 1000), NOW);
    expect(result.applicable).toBe(false);
    expect(result.met).toBeNull();
    expect(result.reasonCode).toBe("not_a_fixed_duration_target");
  });

  it("listPolicies delegates to the repository", async () => {
    policies.listAll.mockResolvedValue([policy()]);
    const result = await service.listPolicies();
    expect(result).toHaveLength(1);
  });
});
