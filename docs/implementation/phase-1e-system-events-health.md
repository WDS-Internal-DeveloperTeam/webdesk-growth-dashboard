# Phase 1E — System Events & Health (as-built)

Branch: `phase-1e-system-events-health`, off `main`. Sixth and final Phase 1E architecture slice
built this session — see `docs/task-packages/phase-1e-system-events-health.md` for the
authorization and design decisions this implements. Covers brief §24–§25 (system activity
foundation, system-health foundation) plus the relevant portions of §26/§28/§29/§34/§37.

## Schema

Three new tables, migrations `00019`–`00022`:

- **`system_events`** (`00019`) — the user-facing activity feed. `event_type` (STRING(64), open
  vocabulary), `category`, `severity` (nullable ENUM `critical`/`high`/`medium`/`low`, same
  vocabulary as `incident_severity_policies`), `source_application`, polymorphic
  `related_entity_type`/`related_entity_id` (unconstrained, same reasoning as
  `audit_events.entity_id`), `correlation_id`, `message` (required), `metadata` (JSONB), and
  `related_audit_event_id` — a **real** nullable FK → `audit_events.id`, `ON DELETE SET NULL`.
  Append-only (`created_at` only, no `updated_at`).
- **`system_components`** (`00020`) — a small catalog table: `key` (unique STRING(64)),
  `display_name`, `description`. Seeded, not application-writable.
- **`system_components` seed** (`00021`) — exactly the 10 approved subsystems from brief §25:
  `api`, `database`, `background_execution`, `notification_delivery`, `integrations`, `storage`,
  `github`, `wordpress`, `email`, `queue_workflow_systems`.
- **`system_health_checks`** (`00022`) — append-only status-observation history. `component_key`
  (FK → `system_components.key`, `ON DELETE RESTRICT` — a component in active use can't be
  silently dropped out from under its history), `status` (ENUM
  `unknown`/`healthy`/`degraded`/`unavailable`/`not_configured`), `detail`, `checked_by_user_id`
  (nullable FK → `users.id`, `ON DELETE SET NULL`), `source` (STRING(64), default `"manual"`),
  `correlation_id`, `created_at` only.

All three FK behaviors (`SET NULL` on both the audit-event link and the actor link, `RESTRICT` on
the component link) are proven against a real database in
`packages/database/test/phase1e-system-operations.integration.test.ts`, not just declared in the
migration.

## packages/database

`packages/database/src/system-operations/`: `entities.ts` (`SystemEventEntity`,
`SystemComponentEntity`, `SystemHealthCheckEntity`, plus the `SystemEventSeverity` and
`SystemHealthStatus` unions), `models.ts` (the usual WeakMap-cached Sequelize model getter),
and three repositories:

- `SystemEventRepository` — `record()`, `findById()`, `list()` (filtered on `eventType`,
  `category`, `severity`, `relatedEntityType`/`relatedEntityId`, `correlationId`; paginated,
  `DEFAULT_LIST_LIMIT=50`/`MAX_LIST_LIMIT=200`).
- `SystemComponentRepository` — read-only from the application's perspective (`findByKey()`,
  `listAll()`); the 10 rows are seed data, never created via this repository.
- `SystemHealthCheckRepository` — `record()`, `findMostRecentForComponent()`,
  `findHistoryForComponent()`. Never updates a row — "current status" is a query concept
  (most-recent-by-`created_at`), not stored state.

Exported from both `packages/database/src/index.ts` and `index.cjs.ts` — the dual-barrel
requirement from this project's own standing caution (a missing CJS export caused a real
production outage earlier in this project; see root `CLAUDE.md`'s "Cautions" section).

Also extended `packages/database/src/audit/entities.ts`'s `AuditEventType` union with one new
value: `system_health_check_recorded` (mirrored into
`apps/dashboard-api/src/audit/audit.service.ts`'s `AUDIT_EVENT_TYPES` array — the same two-file
pattern every prior Phase 1E slice that added an audit event type has followed).

## dashboard-api

`apps/dashboard-api/src/system-operations/`:

- `SystemActivityService` — thin wrapper over `SystemEventRepository`. `record()` never implies
  or creates an audit event; a caller that needs both makes both calls explicitly (brief §24's own
  "may generate both... when required," not "always generates both").
- `SystemHealthService` — `recordCheck()` validates the component exists (`NotFoundException`
  otherwise), records the check, and — only when a human actor (`checkedByUserId`) performed it —
  emits a `system_health_check_recorded` audit event. `getCurrentStatus()` is the literal
  mechanical enforcement of brief §25's "do not show 'Healthy' for an integration that has never
  been tested": zero history resolves to a synthetic `{ status: "unknown", checkedAt: null,
source: null }`, never a fabricated `"healthy"`. `getAllCurrentStatuses()` resolves a status for
  every seeded component, including ones with no history at all.
- `SystemOperationsController` — five routes, all behind `SessionGuard` +
  `@RequirePermission("system_settings", ...)`:
  - `GET /system-events` — `system_health_view`
  - `GET /system-health/components` — `system_health_view`
  - `GET /system-health/status` — `system_health_view` (every component's current status)
  - `GET /system-health/status/:componentKey` — `system_health_view` (single component; an
    unrecognized key resolves to `"unknown"` rather than 404 — the endpoint answers "what do we
    know," and for an unknown key the honest answer is still "nothing")
  - `POST /system-health/checks` — `system_settings_configure`, additionally gated by
    `OriginCheckGuard` (a real state-changing write). 404s for an unrecognized `componentKey`
    (this route, unlike the status-read routes, is asserting a fact about a specific real
    component, so silently no-oping on a typo would hide a bug).
- `SystemOperationsModule` — imports `AuthModule`, `AuthzModule`, `AuditModule`; registers the
  three repository providers and both services; exports both services for reuse by a future slice.

Both new actions — `system_health_view`, `system_settings_configure` — reuse the existing
`system_settings` permission module from the approved 43-module registry (migration `00015`), per
brief §29's own action names. **Zero `role_permissions` rows seeded** for either action — the same
deny-by-default discipline every Phase 1E slice has followed, proven directly in the e2e suite by
showing that even a real `super_admin` session (which holds every _pre-existing_ `system_settings`
grant from the `00013` seed matrix) is denied until a separate, later authorization seeds real
grants.

## Tests

- **Unit** (`system-activity.service.spec.ts`, `system-health.service.spec.ts`): activity
  recording with and without a linked audit event; health-check recording including the
  `NotFoundException` path and the conditional (human-actor-only) audit emission;
  `getCurrentStatus()`'s `"unknown"`-vs-most-recent-status branches; `getAllCurrentStatuses()`
  resolving a status for every component even when some have zero history. 9 tests.
- **Integration** (`packages/database/test/phase1e-system-operations.integration.test.ts`, real
  disposable PostgreSQL): the 10 seeded components present and correctly keyed; health-check
  history ordering; the FK `RESTRICT` on an unknown `component_key`; the FK `SET NULL` on
  `checked_by_user_id` when the referencing user is deleted; the real FK link from
  `system_events.related_audit_event_id` to a genuine `audit_events` row, including rejecting a
  link to a nonexistent one. 12 tests.
- **e2e** (`apps/dashboard-api/test/system-operations.e2e-spec.ts`, real disposable PostgreSQL,
  full Nest module graph): 401 with no session on every route; 403 for `super_admin` on every
  route (proving the zero-seed design against real seed data, not a mock); 200/201 for a role
  directly granted the two new actions (via a raw `role_permissions` insert in the test's own
  setup — there is no production path that grants them yet); `OriginCheckGuard` rejecting the
  write route with no `Origin` header even for a granted user; Zod validation rejecting an invalid
  `status` enum value; 404 for an unrecognized `componentKey` on the write route; and an
  end-to-end round-trip proving a recorded check is visible via the status-read route immediately
  after. 11 tests.

## Validation

Fresh disposable PostgreSQL 17 database, `packages/database/dist`/`dist-cjs` cleared first (per
this project's own standing artifact-leakage caution):

- `pnpm typecheck` — clean, all 9 packages.
- `pnpm lint` — clean, all 9 packages.
- `pnpm format` — clean (9 files auto-fixed via `format:write`, all whitespace/style only,
  verified no content change).
- `packages/database` unit + integration: migration `00019`–`00022` up/down round-trip clean;
  60/60 integration tests (12 new).
- `apps/dashboard-api` unit: 158/158 (9 new).
- `apps/dashboard-api` integration (e2e): 50/50 (11 new).
- `pnpm audit`: 0 vulnerabilities.
- `git status` reviewed before commit: no secrets, exactly the expected file set.

## What this slice does NOT include

Same boundary the task package already states: no real probes for any of the 10 named subsystems
(brief §25's own "do not connect all systems yet"); no scheduled/cron-triggered health checking
(would need Vercel Cron, a separate later authorization); no independent code review or dedicated
security review of this slice; no traceability-matrix/HANDOFF/phase-plan update. This completes
the sixth and final Phase 1E architecture piece from the original authorization brief — all six
slices (audit foundation, jobs, notifications, retention, operational contacts, system
events/health) now exist as independently pushed, unmerged branches. Merging any of them, or any
follow-on process step (code review, security review, gate approval), remains a separate,
not-yet-requested authorization.
