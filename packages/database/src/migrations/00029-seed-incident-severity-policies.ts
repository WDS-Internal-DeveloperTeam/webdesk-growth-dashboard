import { randomUUID } from "node:crypto";
import type { QueryInterface } from "sequelize";

/**
 * Seeds the real, already-approved incident-severity response targets from
 * Phase 1E operational-contacts brief §18. Three of the four have a real
 * fixed-duration target; "low" is approved as "scheduled maintenance" —
 * not a duration at all, represented honestly via `is_fixed_duration =
 * false` rather than a fabricated number.
 */
const POLICIES: ReadonlyArray<{
  severity: "critical" | "high" | "medium" | "low";
  value: number | null;
  unit: "minutes" | "hours" | "business_days" | null;
  description: string;
  isFixedDuration: boolean;
}> = [
  {
    severity: "critical",
    value: 15,
    unit: "minutes",
    description: "15 minutes",
    isFixedDuration: true,
  },
  {
    severity: "high",
    value: 1,
    unit: "hours",
    description: "1 hour",
    isFixedDuration: true,
  },
  {
    severity: "medium",
    value: 1,
    unit: "business_days",
    description: "1 business day",
    isFixedDuration: true,
  },
  {
    severity: "low",
    value: null,
    unit: null,
    description: "Scheduled maintenance — no fixed response-time SLA",
    isFixedDuration: false,
  },
];

export async function up({ context }: { context: QueryInterface }): Promise<void> {
  const now = new Date();
  await context.bulkInsert(
    "incident_severity_policies",
    POLICIES.map((policy) => ({
      id: randomUUID(),
      severity: policy.severity,
      response_target_value: policy.value,
      response_target_unit: policy.unit,
      response_target_description: policy.description,
      is_fixed_duration: policy.isFixedDuration,
      created_at: now,
      updated_at: now,
    })),
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.bulkDelete("incident_severity_policies", {
    severity: POLICIES.map((policy) => policy.severity),
  });
}
