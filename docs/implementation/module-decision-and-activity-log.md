# Decision and Activity Log — module #37

## Scope

Built directly on an explicit instruction to build the module's backend query surface, following
this project's 2026-08-27 "collapse the task-package + implementation-doc pair" standing rule
(`CLAUDE.md`'s Cautions section) — this single file holds both the pre-build scope (this section)
and the as-built record (below), rather than a separate task-package file.

Per `webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md`'s own "## 37.
Decision and Activity Log" section, this module is a **read-only, human-friendly query surface
over the EXISTING `audit_events` table** (ADR-0017, already built and live in production since
Phase 1E — `packages/database/src/audit/entities.ts`, `packages/database/src/audit/audit-event.repository.ts`,
`apps/dashboard-api/src/audit/audit.service.ts`). It is NOT a new table, NOT a new write path, and
NOT a duplicate of module #43 "Audit Logs and System Health" (a separate, broader system-health
module with its own controller at `apps/dashboard-api/src/system-operations/`). This closes the
"a query HTTP surface" gap `docs/task-packages/phase-1e-audit-foundation.md` itself explicitly
deferred at the time the audit-foundation slice was built. No `dashboard-web` UI in this pass,
matching every other module's own backend-first precedent in this project.

Two design decisions were confirmed directly rather than invented:

1. **RBAC**: reuses the existing, already-seeded `system_settings` permission group as-is
   (migration `00015`'s own seed comment already names it as this module's gate: "Decision/
   Activity Log and Audit Logs/System Health are both audit-log-subsystem territory... provisionally
   gated by system_settings until Task 7 defines their own permission model"). No new RBAC
   migration. Every read route is gated on the `system_settings` group's `view` action via the
   standard `@RequirePermission`/`PermissionGuard` pattern, mirroring `SystemOperationsController`'s
   own identical gating for its sibling `system-events`/`system-health` routes. Per migration
   `00013`'s own seeded matrix, `system_settings` grants are deliberately narrow — only
   `super_admin` (`VCERM`) and `owner_growth_approver` (`VM`) hold `view` at all; every other role
   is denied outright.
2. **Event-type scope**: filters server-side to a real subset of the actual ~35-value
   `AuditEventType` union (`packages/database/src/audit/entities.ts`), not the full union, mapped
   from the spec's own event-language ("business decisions, content decisions, design approvals,
   staging approvals, production approvals, rollback, failed deployment, backup/restore, code
   review, PR, scan, import, Git sync, security exception"). The exact chosen list, and the
   reasoning behind each mapping decision, is recorded as a real exported constant with its own
   doc comment — `DECISION_AND_ACTIVITY_LOG_EVENT_TYPES` in
   `apps/dashboard-api/src/decision-and-activity-log/decision-and-activity-log.constants.ts` —
   rather than restated here, so the reasoning stays next to the code it governs and can't drift
   out of sync with it. Chosen list: `approval`, `rejection`, `revision_requested`, `publish`,
   `unpublish`, `release`, `rollback`, `backup`, `restore`, `security_exception`, `scan_run`,
   `import_run`, `export_run`, `git_sync`, `data_change`, `project_status_changed`. Explicitly
   excluded: every session/login/permission-change/job/notification/operational-contact/
   system-health/emergency-admin/account-recovery event type — module #43's own territory, not
   this module's.

`beforeState`/`afterState` are returned **unredacted** — a deliberate decision recorded directly in
`DecisionAndActivityLogService`'s own doc comment, not an oversight: (1) access is already the
narrowest RBAC gate in the whole seeded matrix (only the two most trusted roles hold
`system_settings:view` at all); (2) this exact "the audit trail carries raw pre-redaction content"
shape is already accepted, tracked debt on the WRITE side across multiple already-shipped modules
(Business Knowledge Center's/Service Library's/Persona Library's own `update()` `afterState` calls
all log the unredacted patch verbatim, each independently reviewed and accepted); this read
surface doesn't introduce a new exposure — it makes visible, to the same two already-trusted roles,
data that was already being written; (3) building genuine per-event confidential-field redaction
would need a generic mechanism keyed to "which module/entity type produced this row, and what are
ITS confidential fields" — no such mechanism exists anywhere in this codebase (every existing
redaction call is scoped to one module's own known field names) — a disproportionate, novel
mechanism for a light, backend-only query-surface module.

## As-built

Branch: `module-decision-and-activity-log`.

**`packages/database`** (migrations `00113`/`00114`):

- `00113-add-audit-events-event-type-created-at-index.ts` — a composite `(event_type, created_at)`
  index on `audit_events`, supporting this module's own primary query shape
  (`WHERE event_type IN (...) ORDER BY created_at DESC`). `audit_events` already had a
  single-column `event_type` index and a single-column `created_at` index (migration `00018`) plus
  a `(project_id, created_at)` composite (migration `00019`), but nothing covering `event_type`
  alongside `created_at` together — the exact shape this module's own list query needs.
- `00114-mark-decision-and-activity-log-in-development.ts` — marks `module_registry.implementation_status`
  `in_development` for `decision_and_activity_log`, mirroring `00110-mark-technical-center-in-development.ts`'s
  own pattern exactly.
- `packages/database/src/audit/audit-event.repository.ts` gained a new `list(filter)` method and a
  new exported `AuditEventListFilter` interface — `eventTypes` (required — the repository stays
  generic/reusable; the calling service decides the default allowlist), `projectId`,
  `actorUserId`, `entityType`, `entityId`, `createdAfter`/`createdBefore` (ISO strings), `limit`/
  `offset` (clamped `DEFAULT_LIST_LIMIT = 20` / `MAX_LIST_LIMIT = 100`, mirroring
  `BusinessKnowledgeRecordRepository.list()`'s own `DEFAULT_LIST_LIMIT`/`MAX_LIST_LIMIT` pattern),
  ordered newest-first. Exported from `packages/database/src/audit/index.ts`; both
  `packages/database/src/index.ts` and `index.cjs.ts` already re-export the whole `audit` subpath
  via `export * from "./audit/index.js"`, so no separate barrel edit was needed for either the ESM
  or the CJS build (`CLAUDE.md`'s own documented production-outage caution about the two barrels
  drifting was checked directly, not assumed).

**`apps/dashboard-api`** (new module, `apps/dashboard-api/src/decision-and-activity-log/`):

- `decision-and-activity-log.constants.ts` — `DECISION_AND_ACTIVITY_LOG_MODULE_KEY` and the
  `DECISION_AND_ACTIVITY_LOG_EVENT_TYPES` allowlist constant with its own full reasoning (see
  Scope above).
- `decision-and-activity-log.dto.ts` — `listDecisionAndActivityLogEventsQuerySchema`, a Zod query
  schema: `eventType` (one or more, validated against the module's own allowlist via `z.enum`,
  normalized from a single value or an already-array-parsed repeated query param into an array;
  anything outside the allowlist is rejected with a clean 400, never silently ignored),
  `projectId`/`actorUserId` (UUID), `entityType`/`entityId` (length-capped strings),
  `from`/`to` (ISO datetime strings, matching the `z.string().datetime()` convention already used
  elsewhere in this codebase), `limit`/`offset` (coerced numbers, `limit` capped at 100).
- `decision-and-activity-log.service.ts` — `DecisionAndActivityLogService`, injecting `AuditService`
  directly (not the repository) and calling its new `AuditService.list()` delegation method (see
  below). Applies the default event-type allowlist when the caller supplies none.
- `decision-and-activity-log.controller.ts` — one `GET /decision-and-activity-log/events` route,
  method-level `@RequirePermission(DECISION_AND_ACTIVITY_LOG_MODULE_KEY, "view")` (never
  class-level — this project's own repeatedly-found bug class, avoided from the start here),
  `@UseGuards(SessionGuard)` at class level plus `@UseGuards(PermissionGuard)` on the route,
  mirroring `SystemOperationsController`'s exact guard-stack shape.
- `decision-and-activity-log.module.ts` — imports `AuthModule` (`SessionGuard`), `AuthzModule`
  (`PermissionGuard`), and `AuditModule` (`AuditService`).
- Wired into `apps/dashboard-api/src/app.module.ts`.

**`apps/dashboard-api/src/audit/audit.service.ts`** gained a new `list(filter)` method — a narrow,
read-only delegation to `AuditEventRepository.list()`. `AuditModule` still exports only
`AuditService`, never `AUDIT_EVENT_REPOSITORY` itself, matching this project's own established
preference for narrow delegating methods over broad cross-module repository exports (e.g.
`ServicesService.existingServiceIds()`, `PagesService.existsInProject()`) — this was a deliberate
choice over the alternative of widening `AuditModule`'s exports to include the raw repository.

## Validation

Every command below was actually run in this session against a real local disposable PostgreSQL 17
database (`webdesk_dal_dev`), and the exact pass/fail counts recorded reflect real output, not
assumptions.
