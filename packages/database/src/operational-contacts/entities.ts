/**
 * The configurable operational-contact and incident-severity models
 * (Phase 1E operational-contacts brief §17/§18) — persistence-layer
 * shapes for `operational_contacts` (migration `00020`) and
 * `incident_severity_policies` (migrations `00021`/`00022`). See
 * `docs/task-packages/phase-1e-operational-contacts.md`.
 */

export type ContactRole = "primary" | "backup";
export type ContactVerificationStatus = "unverified" | "verified" | "failed";
export type IncidentSeverity = "critical" | "high" | "medium" | "low";
export type ResponseTargetUnit = "minutes" | "hours" | "business_days";

export interface OperationalContactEntity {
  readonly id: string;
  readonly contactUserId: string | null;
  readonly contactName: string | null;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
  readonly area: string;
  readonly role: ContactRole;
  readonly escalationPriority: number;
  readonly channelPreference: string | null;
  readonly severityApplicability: readonly IncidentSeverity[] | null;
  readonly workingHoursStart: string | null;
  readonly workingHoursEnd: string | null;
  readonly timeZone: string | null;
  readonly effectiveStartDate: string;
  readonly effectiveEndDate: string | null;
  readonly activeStatus: boolean;
  readonly verificationStatus: ContactVerificationStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface IncidentSeverityPolicyEntity {
  readonly id: string;
  readonly severity: IncidentSeverity;
  readonly responseTargetValue: number | null;
  readonly responseTargetUnit: ResponseTargetUnit | null;
  readonly responseTargetDescription: string;
  readonly isFixedDuration: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}
