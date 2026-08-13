/**
 * The ADR-0017 general-purpose audit-log subsystem — persistence-layer
 * shapes for `audit_events` (migration 00018). Distinct from
 * `../auth/entities.ts`'s `AuthEventEntity`, which backs the narrower,
 * login-scoped `auth_events` table. See
 * `docs/task-packages/phase-1e-audit-foundation.md`.
 */

export type AuditEventType =
  | "login"
  | "login_rejected"
  | "logout"
  | "session_revoked"
  | "permission_change"
  | "confidential_field_access_change"
  | "user_activation"
  | "user_deactivation"
  | "data_change"
  | "approval"
  | "rejection"
  | "revision_requested"
  | "publish"
  | "unpublish"
  | "release"
  | "rollback"
  | "backup"
  | "restore"
  | "retention_run"
  | "security_exception"
  | "scan_run"
  | "import_run"
  | "export_run"
  | "git_sync"
  | "webhook_processed"
  | "job_created"
  | "job_completed"
  | "job_failed"
  | "job_retry_requested"
  | "job_cancellation_requested"
  | "emergency_admin_login"
  | "account_recovery_request"
  | "account_recovery_decision";

export type AuditActorType = "human" | "system" | "service_account";

/** Per knowledge/11's retention matrix — e.g. "audit-7y" for general audit records, "approval-audit-7y" for immutable approval events, "security-log-1y" for security-exception-class events. STRING, not a closed TS union, since the matrix itself is a controlled but evolvable list. */
export type AuditRetentionCategory = string;

/**
 * The initial controlled `retention_category` set (same three worked examples as the doc comment
 * above) — exported as a real runtime array, not just encoded in `AuditService`'s own copy, so
 * `AuditEventRepository.record()` can validate it too. Before this, `retentionCategory` was only
 * checked in `AuditService` — a caller that reached the repository directly (bypassing
 * `AuditService`) could persist an unrecognized value with no enforcement at all, since the DB
 * column is deliberately `STRING`, not an ENUM/CHECK (see migration `00018`'s own doc comment —
 * the vocabulary is meant to grow without a migration). `apps/dashboard-api`'s `AuditService`
 * derives its own closed `AuditRetentionCategory` union type from this same array, so both layers
 * share one source of truth instead of maintaining separate copies that could drift.
 */
export const AUDIT_RETENTION_CATEGORIES = [
  "audit-7y",
  "approval-audit-7y",
  "security-log-1y",
] as const;

/**
 * Groups `event_type` values into a broader vocabulary (migration 00019) —
 * always derived by `AuditService`'s exhaustive event_type→category
 * mapping, never left to the caller to supply. STRING, same "controlled
 * but evolvable, not a Postgres ENUM" reasoning as `event_type` itself.
 */
export type AuditEventCategory = string;

/** Per knowledge/12-dashboard-security-controls.md's confidentiality model — e.g. "internal" (default; standard audit.view clearance) vs "confidential" (a future, stricter clearance). STRING, evolvable. */
export type AuditConfidentialityClassification = string;

/** Append-only — no `updatedAt` exists on this table at all (not merely omitted from writes), so this deliberately does not extend `BaseEntity`. */
export interface AuditEventEntity {
  readonly id: string;
  readonly eventType: AuditEventType;
  readonly eventCategory: AuditEventCategory;
  readonly actorUserId: string | null;
  readonly actorType: AuditActorType;
  readonly sessionId: string | null;
  readonly projectId: string | null;
  readonly entityType: string;
  readonly entityId: string;
  readonly entityVersion: number | null;
  readonly action: string;
  readonly beforeState: Record<string, unknown> | null;
  readonly afterState: Record<string, unknown> | null;
  readonly reason: string | null;
  readonly relatedGateOrApprovalId: string | null;
  readonly gitCommitSha: string | null;
  readonly correlationId: string | null;
  readonly sourceApplication: string;
  readonly environment: string;
  readonly confidentialityClassification: AuditConfidentialityClassification;
  readonly retentionCategory: AuditRetentionCategory;
  readonly legalHold: boolean;
  readonly legalHoldReason: string | null;
  readonly createdAt: string;
}
