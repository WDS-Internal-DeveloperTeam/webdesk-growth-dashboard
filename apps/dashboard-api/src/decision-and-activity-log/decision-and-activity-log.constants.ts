import type { AuditEventType } from "@webdesk/database";

/**
 * The `module_registry.key` (migration `00015`) — the 43-module UI/navigation registry, distinct
 * from the RBAC `modules` table below. Recorded here for reference (e.g. matching this module up
 * against its own seeded registry row); NOT the value `@RequirePermission` should be called with.
 */
export const DECISION_AND_ACTIVITY_LOG_MODULE_REGISTRY_KEY = "decision_and_activity_log";

/**
 * The real RBAC `modules.key` (migration `00013`'s own `MODULES` list) this module is gated
 * on — deliberately NOT `DECISION_AND_ACTIVITY_LOG_MODULE_REGISTRY_KEY` above, which is a
 * different table with a disjoint 43-value key space. Migration `00015`'s own seed comment names
 * `system_settings` as this module's real permission group: "provisionally gated by
 * system_settings until Task 7 defines their own permission model."
 */
export const DECISION_AND_ACTIVITY_LOG_RBAC_MODULE_KEY = "system_settings";

/**
 * The event-type subset this module exposes — deliberately NOT the full ~35-value
 * `AuditEventType` union `packages/database/src/audit/entities.ts` declares. Per
 * `webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md`'s own "## 37.
 * Decision and Activity Log" section, this module's scope is "business decisions, content
 * decisions, design approvals, staging approvals, production approvals, rollback, failed
 * deployment, backup/restore, code review, PR, scan, import, Git sync, security exception" —
 * spec language, not real `event_type` values, since the spec predates and doesn't reference this
 * codebase's own audit schema. Mapped onto the real values as follows:
 *
 *   - "business decisions" / "content decisions" / "design approvals" / "staging approvals" /
 *     "production approvals" -> `approval` / `rejection` / `revision_requested` (every module's
 *     content-lifecycle approval-workflow transition already funnels through these three, real
 *     `event_type` values, not a bespoke per-domain type)
 *   - "rollback" / "failed deployment" -> `rollback` (this codebase has no distinct
 *     "failed deployment" event type; a failed release is recorded via `release`'s own outcome,
 *     not a separate type — `release` is included below to cover the successful-deployment half
 *     of the same story)
 *   - "backup/restore" -> `backup`, `restore`
 *   - "code review" / "PR" -> no distinct real `event_type` exists for either (this project's own
 *     code-review/PR discipline lives in GitHub, not `audit_events`) — omitted rather than
 *     fabricated; `project_status_changed` is included instead as the closest real "business
 *     decision" event type this codebase actually emits today
 *   - "scan" -> `scan_run`
 *   - "import" -> `import_run` (its sibling `export_run` is included too, since an export is the
 *     same class of operational record-keeping event and the spec's own list is illustrative, not
 *     exhaustive, per its own module's one-line format)
 *   - "Git sync" -> `git_sync`
 *   - "security exception" -> `security_exception`
 *   - "content decisions" (the generic case, not design/staging/production-specific) -> also
 *     `data_change`, this codebase's real event type for a content-lifecycle edit/publish/unpublish
 *     not already covered by `approval`/`publish`/`unpublish` below
 *   - `publish`/`unpublish` are included directly — real content-lifecycle events this codebase
 *     emits that the spec's own "content decisions" language plainly covers
 *
 * Deliberately EXCLUDED — module #43 "Audit Logs and System Health"'s own territory, or
 * plumbing this human-friendly decision/activity view has no reason to surface:
 * `login`/`login_rejected`/`logout`/`session_revoked`/`permission_change`/
 * `confidential_field_access_change`/`user_activation`/`user_deactivation`/`retention_run`/
 * `webhook_processed`/`job_created`/`job_completed`/`job_failed`/`job_retry_requested`/
 * `job_cancellation_requested`/`retention_hold_created`/`retention_hold_released`/
 * `notification_created`/`notification_delivery_outcome`/`operational_contact_created`/
 * `operational_contact_updated`/`system_health_check_recorded`/`emergency_admin_login`/
 * `account_recovery_request`/`account_recovery_decision`.
 */
export const DECISION_AND_ACTIVITY_LOG_EVENT_TYPES: readonly AuditEventType[] = [
  "approval",
  "rejection",
  "revision_requested",
  "publish",
  "unpublish",
  "release",
  "rollback",
  "backup",
  "restore",
  "security_exception",
  "scan_run",
  "import_run",
  "export_run",
  "git_sync",
  "data_change",
  "project_status_changed",
];
