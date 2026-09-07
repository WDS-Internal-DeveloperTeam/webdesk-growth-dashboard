import type { AuditEventType } from "@webdesk/database";

/**
 * The `module_registry.key` (migration `00035`) — the 43-module UI/navigation registry, distinct
 * from the RBAC `modules` table below. Recorded here for reference (e.g. matching this module up
 * against its own seeded registry row); NOT the value `@RequirePermission` should be called with.
 */
export const AUDIT_LOGS_AND_SYSTEM_HEALTH_MODULE_REGISTRY_KEY = "audit_logs_and_system_health";

/**
 * The real RBAC `modules.key` (migration `00013`'s own `MODULES` list) this module is gated
 * on — deliberately NOT `AUDIT_LOGS_AND_SYSTEM_HEALTH_MODULE_REGISTRY_KEY` above, which is a
 * different table with a disjoint 43-value key space. Same real permission group as Decision and
 * Activity Log, System Settings, and Integrations — migration `00013`'s own
 * `system_settings: { super_admin: "VCERM", owner_growth_approver: "VM" }` row.
 */
export const AUDIT_LOGS_AND_SYSTEM_HEALTH_RBAC_MODULE_KEY = "system_settings";

/**
 * The event-type subset this module exposes — the exact complement of
 * `DECISION_AND_ACTIVITY_LOG_EVENT_TYPES`
 * (`../decision-and-activity-log/decision-and-activity-log.constants.ts`), which explicitly names
 * this module's own territory in its own doc comment. Together the two lists form a clean
 * partition of the full ~41-value `AuditEventType` union declared in
 * `packages/database/src/audit/entities.ts` — every real event type appears in exactly one of the
 * two modules' allowlists, never both, never neither (independently re-verified against the real
 * union at build time — see `docs/implementation/module-audit-logs-and-system-health.md`'s
 * As-built section for the count).
 *
 * Per `webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md §43`'s own field
 * list ("Login events, permission changes, data changes, Git sync, webhook status, jobs, queues,
 * scans, malware-scan placeholder status, failed jobs/retries, cron/WP-Cron, backups, storage,
 * application errors, security events, agent execution status") mapped onto the real values as
 * follows:
 *
 *   - "Login events" -> `login`, `login_rejected`, `logout`, `session_revoked`
 *   - "permission changes" -> `permission_change`, `confidential_field_access_change`,
 *     `user_activation`, `user_deactivation` (account-level access changes, the closest real
 *     event types to the spec's own "permission changes" language beyond the RBAC-grant case
 *     itself, which this codebase records via `permission_change`)
 *   - "jobs, queues... failed jobs/retries" -> `job_created`, `job_completed`, `job_failed`,
 *     `job_retry_requested`, `job_cancellation_requested`
 *   - "webhook status" -> `webhook_processed`
 *   - "backups" -> `retention_run`, `retention_hold_created`, `retention_hold_released` (this
 *     codebase's real retention/backup-governance event types — a distinct `backup`/`restore`
 *     pair already exists and is Decision and Activity Log's own territory, since those record a
 *     completed business-decision-shaped operation rather than ongoing retention-policy
 *     housekeeping)
 *   - "application errors" / "security events" -> `security_exception` is Decision and Activity
 *     Log's own territory (a completed decision record); this module has no distinct "raw
 *     application error" event type to include, since no such `event_type` value exists anywhere
 *     in this codebase's real `AuditEventType` union — omitted rather than fabricated
 *   - "cron/WP-Cron" -> no distinct real event type exists (no WP-Cron adapter is built yet) —
 *     omitted rather than fabricated
 *   - "storage" -> no distinct real event type exists for raw storage/disk metrics — omitted
 *   - "malware-scan placeholder status" / "scans" / "agent execution status" -> `scan_run` is
 *     Decision and Activity Log's own territory (a completed business-decision-shaped record);
 *     this module has no distinct real event type for in-progress scan/agent-execution status
 *   - the remaining values below (`notification_created`/`notification_delivery_outcome`,
 *     `operational_contact_created`/`operational_contact_updated`,
 *     `system_health_check_recorded`, `emergency_admin_login`, `account_recovery_request`/
 *     `account_recovery_decision`) are real, already-shipped operational/system-health/
 *     emergency-access event types with no closer fit in Decision and Activity Log's own
 *     business-decision-shaped territory — included here as this module's own "system health and
 *     operational plumbing" scope, matching its own `03_Detailed_Module_Specifications.md §43`
 *     framing ("agent execution status", "application errors" being the closest named categories)
 *
 * This exact 25-value list is also `DECISION_AND_ACTIVITY_LOG_EVENT_TYPES`'s own doc comment's
 * "Deliberately EXCLUDED... module #43 'Audit Logs and System Health''s own territory" list,
 * copied verbatim — the two files' allowlists were authored from the same single source of truth,
 * not independently derived, closing any risk of drift between them.
 */
export const AUDIT_LOGS_AND_SYSTEM_HEALTH_EVENT_TYPES: readonly AuditEventType[] = [
  "login",
  "login_rejected",
  "logout",
  "session_revoked",
  "permission_change",
  "confidential_field_access_change",
  "user_activation",
  "user_deactivation",
  "retention_run",
  "webhook_processed",
  "job_created",
  "job_completed",
  "job_failed",
  "job_retry_requested",
  "job_cancellation_requested",
  "retention_hold_created",
  "retention_hold_released",
  "notification_created",
  "notification_delivery_outcome",
  "operational_contact_created",
  "operational_contact_updated",
  "system_health_check_recorded",
  "emergency_admin_login",
  "account_recovery_request",
  "account_recovery_decision",
];
