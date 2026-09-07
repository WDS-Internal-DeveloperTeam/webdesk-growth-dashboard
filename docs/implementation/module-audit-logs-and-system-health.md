# Module: Audit Logs and System Health

## Scope

**Module key:** `audit_logs_and_system_health` — already seeded in `module_registry` (migration
`00035`), route `/audit-logs-and-system-health`, navigation group `settings`, no dependencies,
`confidentialityLevel: "immutable events required for critical actions (master spec security
section)"`. RBAC group `system_settings` (migration `00013`, same group as System Settings and
Integrations) — `super_admin` holds `VCERM`, `owner_growth_approver` holds `VM`.

**Canonical spec** (`03_Detailed_Module_Specifications.md §43`): "Login events, permission
changes, data changes, Git sync, webhook status, jobs, queues, scans, malware-scan placeholder
status, failed jobs/retries, cron/WP-Cron, backups, storage, application errors, security events,
agent execution status."

**Scope decision, confirmed directly with the project owner (`AskUserQuestion`):** this module
overlaps heavily with infrastructure already built and already exposed via real HTTP routes —
`system-events`/`system-health/components`/`system-health/status` (Phase 1E,
`system-operations.controller.ts`) and `jobs`/`jobs/:id`/`retry`/`cancel`
(`jobs.controller.ts`) are all already live. Decision and Activity Log (module #37) already
exposes the "decision/activity" half of `audit_events`, and its own doc comment
(`decision-and-activity-log.constants.ts`) explicitly names the complementary event-type set as
**this** module's own territory:

```
login | login_rejected | logout | session_revoked | permission_change |
confidential_field_access_change | user_activation | user_deactivation | retention_run |
webhook_processed | job_created | job_completed | job_failed | job_retry_requested |
job_cancellation_requested | retention_hold_created | retention_hold_released |
notification_created | notification_delivery_outcome | operational_contact_created |
operational_contact_updated | system_health_check_recorded | emergency_admin_login |
account_recovery_request | account_recovery_decision
```

**The user chose "query surface only, over already-existing data"** — this backend pass adds
exactly one new thing: a read-only query endpoint over the `audit_events` table, filtered to the
24-value complement above, mirroring Decision and Activity Log's own module file-for-file. It does
**not** re-expose `jobs`/`system-events`/`system-health` under this module's own route prefix —
those already have real, live, working endpoints elsewhere in the API surface; a future
`dashboard-web` UI pass for this module can call multiple existing endpoints rather than this
backend proxying them. Webhook status, backups, storage, and application errors stay explicitly
out of scope — no table or mechanism for any of them exists anywhere in this codebase yet, matching
Scan Center's/Ready for Claude Queue's own precedent of not building an execution engine that
doesn't exist, and System Settings' own precedent of not duplicating a table that already lives
elsewhere.

**No new table, no new RBAC migration.** Migration `00122` marks
`module_registry.implementation_status = 'in_development'` for `audit_logs_and_system_health` —
the only schema change in this pass. No confidentiality/redaction mechanism beyond what
`AuditEventEntity` already carries (this module surfaces `beforeState`/`afterState` unredacted,
matching Decision and Activity Log's own already-accepted precedent).

## As-built

(filled in after the build)
