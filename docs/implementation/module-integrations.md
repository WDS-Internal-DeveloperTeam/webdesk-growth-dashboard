# Integrations module — backend

## Scope

Module key `integrations` (module #41 per `03_Detailed_Module_Specifications.md`), Wave 1 on the
dependency-computed roadmap (`docs/phase-plans/module-implementation-roadmap.md`) — no
dependencies. Built directly on the explicit "start integrations module" instruction.

The canonical spec gives no field-level schema — only a one-line description ("GitHub, WordPress,
Vercel Blob, PostgreSQL, Upstash, SMTP, Sentry, uptime, vulnerability scan, future malware
scanner") and, in `04_Data_Model_and_Ownership.md §"Notifications and integrations"`, four table
names with no columns: `integrations`, `integration_environments`, `webhook_events`,
`secret_metadata`. The module registry's own already-seeded entry
(`packages/database/src/migrations/00035-populate-module-registry-fields.ts`) is the one concrete
design signal that exists: `confidentialityLevel: "secret values never stored — metadata/
verification status only"`, and `permissionGroupKey: "integrations"` maps to the already-seeded
`system_settings` RBAC group (`00015-seed-module-registry.ts`), reused verbatim — no new RBAC
migration.

Two design forks were confirmed directly with the user first (`AskUserQuestion`):

1. **Record-keeping only, not real health checks.** This module tracks integration status/config
   metadata and lets an admin manually record a verification result. It does NOT make real
   outbound calls to GitHub/WordPress/Vercel Blob/SMTP/Sentry/etc. — matching the precedent
   already set by Scan Center, Technical Center, and Ready for Claude Queue (each ships the full
   data model and RBAC-gated API surface for a mechanism with no execution engine yet).
2. **All four named tables, built now** — `integrations`, `integration_environments`,
   `webhook_events`, `secret_metadata` — rather than deferring the latter two.

### Schema (own design, no field-level spec source)

- **`integrations`** — one row per external service connection.
  `id`, `publicId`, `provider` (closed enum — `github | wordpress | vercel_blob | postgresql |
smtp | sentry | uptime_monitor | vulnerability_scanner | upstash | other`, taken from the
  spec's own named list plus `other` for anything not named), `displayName`, `status`
  (`connected | disconnected | error | not_configured`), `configReference` (plain text — where
  the real secret/config actually lives, e.g. "Vercel env: dashboard-api /
  GOOGLE_OAUTH_CLIENT_SECRET" — never the value itself, matching the confidentiality note),
  `notes` (plain text — ops notes, not user-facing content, so no rich-text/sanitization needed,
  matching Scan Center's/Technical Center's own precedent for internal ops metadata),
  `lastVerifiedAt`, `lastVerifiedByUserId` (nullable FK `users`, `SET NULL` on delete),
  `lastVerificationResult` (`success | failure | unknown`), `lastVerificationNotes` (plain text),
  `isActive` (boolean, default `true`), `createdAt`/`updatedAt`. No hard delete — `isActive:
false` is the retirement mechanism, matching every content-library module's own precedent
  (deprecated status = retirement, not deletion).
- **`integration_environments`** — a real one-to-many sub-resource (a real, existence-validated
  FK `integrationId`). `id`, `integrationId`, `environmentName` (plain text — "staging",
  "production", etc., no fixed taxonomy in the spec), `status` (same 4-value enum as
  `integrations`), `configReference`, `notes`, `lastVerifiedAt`, `createdAt`/`updatedAt`. Real
  delete allowed (a Projects-sub-resource-style config row, not a historical record needing
  retention).
- **`webhook_events`** — an append-only log of received webhook deliveries. `id`, `integrationId`
  (nullable FK, `SET NULL` — an event may arrive before it can be matched to a known
  integration), `eventType` (plain text), `receivedAt`, `payloadSummary` (plain text — a short,
  human-written or truncated summary, deliberately NOT the raw payload, to avoid storing secrets/
  PII that might be embedded in a real webhook body), `processingStatus`
  (`received | processed | failed`), `errorMessage` (nullable plain text), `createdAt`. No update,
  no delete — immutable, matching the `audit_events` precedent (ADR-0017) for a delivery log.
  Since no real webhook receiver exists yet (no execution engine, per D1), this table's only write
  path is a manual "record an event" endpoint for ops use, not a live receiver.
- **`secret_metadata`** — tracks which secret exists for an integration, never the value. `id`,
  `integrationId` (real FK, `CASCADE`), `secretName` (plain text, e.g.
  `GOOGLE_OAUTH_CLIENT_SECRET`), `storageLocation` (plain text, e.g. "Vercel env var —
  dashboard-api"), `lastRotatedAt` (nullable), `rotationDueAt` (nullable), `notes`, `createdAt`/
  `updatedAt`. Real delete allowed (pure metadata, no compliance/audit reason to retain a deleted
  row) — but deletion is itself an `edit`-gated, audited action.

### RBAC mapping (reusing the seeded `system_settings` group verbatim: `super_admin: VCERM`,

`owner_growth_approver: VM`)

- `view` — list/get on all four tables.
- `create` — create an `integrations`/`integration_environments`/`secret_metadata` row, and
  record a `webhook_events` entry.
- `edit` — update/delete on all four tables (delete only where allowed per-table above).
- `review` — record a verification result (`POST /integrations/:id/verify`) — a distinct action
  from a general field edit, mirroring how this letter is used elsewhere for an attestation-style
  action rather than raw field mutation.
- `configure` (`M`) — toggle `isActive` (`POST /integrations/:id/toggle-active`) — the one action
  `owner_growth_approver` can take beyond viewing, matching System Settings' own precedent of `M`
  being the one non-`super_admin`-exclusive mutation.

Routes use this app's established `POST .../:id/update` convention (not `PATCH`), method-level
`@RequirePermission` decorators only (never class-level — the documented, repeatedly-hit bug
class), and `OriginCheckGuard` on every mutating route.

No `dashboard-web` UI is built in this pass — backend only, matching every prior module's own
backend-first precedent.

## As-built

Built directly (not delegated) on branch `module-integrations`. Migrations `00120`
(`create-integrations` — all four tables, indexes, the `pg_trgm` GIN index on `display_name`, plain
btree indexes on every sub-resource's `integration_id` FK column) and `00121`
(`mark-integrations-in-development`).

**`packages/database/src/integrations/`** — `entities.ts` (plain TS types), `models.ts` (Sequelize
`define()`s, `webhook_events` uses `updatedAt: false` to keep only `created_at` — genuinely
immutable), `entity-mapping.ts`, `index.ts`, and one repository per table
(`integration.repository.ts` incl. the narrow `existsById()` delegating check the sub-resource
services rely on; `integration-environment.repository.ts`/`secret-metadata.repository.ts` both
IDOR-scoped on the compound `(id, integrationId)` per method, mirroring
`ProjectEnvironmentRepository`'s own established fix; `webhook-event.repository.ts`, create/list
only). Both `packages/database/src/index.ts` and `index.cjs.ts` (the separately-maintained CJS
barrel) updated together.

**`apps/dashboard-api/src/integrations/`** — `integrations.constants.ts` (`INTEGRATIONS_MODULE_KEY
= "system_settings"`), `integrations.dto.ts` (`limit` capped at `.max(200)`, not `100`, per the
known incident class this project's own CLAUDE.md documents), `integrations.module.ts`,
`database.providers.ts`, and one controller+service pair per resource. No dynamic
`AuthorizationService.assertAllowed()` service-layer check anywhere in this module — unlike a
content-approval-workflow module, every action here (`view`/`create`/`edit`/`review`/`configure`)
is a single flat RBAC action checked statically at the route via `@RequirePermission`
(method-level only, never class-level), since there's no state machine to gate dynamically.
`webhook-events.controller.ts` exports two controllers sharing one service — a nested
`/integrations/:integrationId/webhook-events` (scoped list) and a bare `/webhook-events`
(list/get/create) — since an event may arrive before it can be matched to a known integration.
Wired into `apps/dashboard-api/src/app.module.ts` (import + registration, alphabetically placed
between `ImportAndExportCenterModule` and `InternalLinkingLibraryModule`).

**Tests**: 4 new `*.service.spec.ts` unit-test files (mocked repositories) and 2 new real-database
test files (`packages/database/test/module-integrations.integration.test.ts`,
`apps/dashboard-api/test/integrations.e2e-spec.ts`).

### Validation — all commands below were actually run, real output captured

A real local disposable PostgreSQL 17 instance was available in this environment
(`webdesk_phase1b_dev`, `DATABASE_SSL=false`) and used for every DB-backed check.

- **Typecheck**: `pnpm --filter @webdesk/database typecheck` and
  `pnpm --filter dashboard-api typecheck` — both clean, 0 errors.
- **Lint**: `pnpm --filter @webdesk/database lint` and `pnpm --filter dashboard-api lint` — both
  clean, `--max-warnings=0`.
- **Prettier**: `pnpm exec prettier --check` on every touched/created file — clean.
- **`pnpm audit --audit-level=high`**: 0 known vulnerabilities.
- **`boundaries:check`** (dependency-cruiser, ADR-0006): 0 errors (10 pre-existing warnings on
  files this branch never touched).
- **Migration round-trip** (real database): `migrate up` → applied `00120`/`00121` cleanly;
  `migrate:down` twice → reverted both cleanly, `migrate:status` confirmed both pending again;
  `migrate up` again → re-applied cleanly, `migrate:status` confirmed `Executed (121) / Pending
(0): none`.
- **`packages/database` unit tests**: 28/28 passed (unchanged — this module has no standalone
  repository unit tests, matching every sibling module's own convention of testing repositories
  only via real-DB integration tests).
- **`packages/database` integration tests** (real database, isolated single-file run to avoid a
  self-inflicted concurrency issue described below): `module-integrations.integration.test.ts` —
  **29/29 passed**. The full suite was also run once, clean, alone: **45/45 files, 887/887 tests
  passed** (includes this file).
- **`dashboard-api` unit tests**: **1894/1894 passed** across 121 files (up from the prior
  session's 1852 baseline — the +42 are the 4 new spec files added here: 17 + 9 + 7 + 9).
- **`dashboard-api` e2e tests** (real database, isolated single-file run):
  `integrations.e2e-spec.ts` — **23/23 passed**. Covers: 401 with no session; the full super_admin
  (`VCERM`) lifecycle (create/read/list/update/verify/toggle-active, duplicate-`publicId` 400,
  malformed-UUID 400, nonexistent-id 404, no-Origin-header 403); `owner_growth_approver` (`VM`
  only) allowed view+toggle-active, denied create/edit/verify; a third role
  (`read_only`, zero grant on `system_settings`) denied even a bare view; `integration_environments`
  full CRUD plus a real cross-integration IDOR attempt (404, not the record); `webhook_events`'
  both the nested and bare routes, a rejected dangling-`integrationId` reference (400), and
  confirmation no update/delete route exists at all; `secret_metadata` full CRUD, a real
  cross-integration IDOR attempt (404), and confirmation the response never carries the secret
  value itself.
- **`validate:module-registry`**: `Module-registry validation passed — 43 modules, 21 permission
groups, all references resolve.`

**A real process mistake, corrected**: my first attempt ran the full `packages/database`
integration suite and this branch's new e2e spec as two concurrent background processes against
the same shared disposable database — both independently calling `migrator.up()`/`down()`,
which raced (real captured error: `cannot drop table jobs because other objects depend on it`) and
produced a false failure in the e2e run (20/23 failing with `403` instead of `201`, because the
RBAC seed data was mid-drop when it ran). Neither failure was a real bug in this module's own
code — confirmed by fully resetting the database (`DROP DATABASE`/`CREATE DATABASE`) and
re-running every DB-backed suite serially, one process at a time, which produced the clean numbers
above.

### Independent code review

This project's own `code-review` skill (high effort, 8-angle finder pass via parallel subagents,
1-vote self-verification) surfaced 10 findings kept in the final report — 3 CONFIRMED, 7
PLAUSIBLE. **8 fixed**, 2 left as accepted, tracked debt:

- **CONFIRMED, most severe**: `GET /integrations/:integrationId/environments` and
  `GET /integrations/:integrationId/secret-metadata` never wired their own already-written
  `listIntegrationEnvironmentsQuerySchema`/`listSecretMetadataQuerySchema` into the route —
  unbounded `findAll`, no pagination cap, dead DTO code. Fixed: both repositories now accept a
  `{limit, offset}` filter (capped at 200, mirroring `WebhookEventRepository.list()`'s own
  pattern), both controllers/services thread the query param through. Two new e2e regression
  tests prove `?limit=` is now honored end-to-end.
- **CONFIRMED**: `IntegrationsService.update()`/`.setActive()` each did an unused `findById()`
  pre-fetch whose result was discarded, wasting one DB round trip per call. Fixed — both now rely
  solely on the repository's own null-return path; two unit tests updated to assert the repository
  method itself is called with the missing id (not a redundant pre-fetch).
- **CONFIRMED**: `IntegrationRepository.list()` orders by `updated_at DESC, id ASC` with no
  supporting index. Fixed — `integrations_updated_at_id_idx` added to migration `00120` (amended,
  not superseded — it hadn't shipped anywhere yet), verified present in the real database.
- **PLAUSIBLE, fixed**: the 3 sub-resource repositories hand-typed their `create()`/`update()`
  input shapes instead of deriving via `Omit<>`/`Pick<>` from the entity, unlike
  `IntegrationRepository`'s own `IntegrationContentFields` in the same PR. Fixed for all three
  (`integration-environment.repository.ts`, `secret-metadata.repository.ts`,
  `webhook-event.repository.ts`), each with a doc comment explaining the one genuine deviation
  (the `Date`-in/`string`-out type asymmetry on the date fields).
- **PLAUSIBLE, fixed**: the empty-patch `.refine()` guard was duplicated verbatim 3 times in
  `integrations.dto.ts`. Fixed with a local `rejectEmptyPatch<T>()` helper mirroring
  `portfolio-library.dto.ts`'s own identically-named, identically-purposed helper; the two
  byte-identical sub-resource list-query schemas were also collapsed into one shared
  `paginationOnlyQuerySchema`.
- **PLAUSIBLE, fixed**: `webhook_events`' doc comments overclaimed DB-trigger-level immutability
  "matching the `audit_events` precedent (ADR-0017)" when no such trigger exists — only the
  repository never defining an update/delete method. Fixed by relabeling every occurrence
  (migration, entity, repository) to match `review_decisions`' own honest, already-established
  phrasing for an application-level (not DB-trigger-enforced) append-only log.
- **PLAUSIBLE, fixed**: `integration_environments.lastVerifiedAt` was a phantom write path — a
  real column and repository capability with no DTO field or route ever able to populate it.
  Fixed by removing it from `update()`'s accepted patch type entirely (the column itself stays;
  nothing currently claims it's a live field).
- **PLAUSIBLE, fixed**: `webhook_events.processing_status` is filtered by `list()` with no
  supporting index. Fixed — `webhook_events_processing_status_idx` added to the same migration.
- **PLAUSIBLE, accepted as tracked debt**: `INTEGRATIONS_MODULE_KEY = "system_settings"` is
  checked with bare action names (`view`/`create`/`edit`/`review`/`configure`), unlike the older
  `system_settings` consumers (`jobs`, `notifications`, `retention`, `operational-contacts`,
  `system-operations`), which all namespace their action strings (`jobs_view`,
  `notifications_configure`, etc.). Verified this is not a fresh deviation this branch introduces —
  the two most recently shipped `system_settings` consumers, Decision and Activity Log and Help
  Center, already use this identical bare-action pattern. A real, pre-existing, repo-wide
  inconsistency between two eras of this codebase's own convention, not something to silently
  "fix" by picking a side inside this module's own PR.
- **PLAUSIBLE, accepted as tracked debt**: the "parent integration exists" check
  (`assertIntegrationExists()`) is hand-copied 3-4 times across the three sub-resource services,
  and `SecretMetadataRepository` is structurally identical to `IntegrationEnvironmentRepository`.
  Matches an already-accepted, out-of-scope duplication pattern present across ≥10 sibling
  `assert*Exists()` helpers elsewhere in this codebase.

Re-validated after every fix: typecheck/lint/prettier clean across both packages; a fresh
migration `down`/`down`/`up` round-trip (both new indexes confirmed present via a direct
`pg_indexes` query); **`packages/database` unit**: 28/28; **`packages/database` integration**:
`module-integrations.integration.test.ts` 29/29 (isolated, serial); **`dashboard-api` unit**:
1894/1894 (one test updated to match the more efficient `update()`/`setActive()` flow);
**`dashboard-api` e2e**: `integrations.e2e-spec.ts` 25/25 (23 original + 2 new pagination
regression tests, isolated, serial); **`validate:module-registry`**: clean (43 modules, 21
permission groups); **`pnpm audit --audit-level=high`**: 0 vulnerabilities. Migrations restored to
the full 121-applied state after every DB-backed test run, matching the shared local dev
database's expected steady state for any other concurrent session on this machine.

### Security review

Run separately from the code review, per the 2026-08-27 "right-size the review pipeline" standing
rule — this is a new endpoint class (a full new RBAC-gated CRUD surface), so it qualifies for the
full pipeline rather than the light tier. **0 findings above threshold.** Specifically verified:
method-level `@RequirePermission` placement on every route across all 4 controllers (never
class-level — the documented bug class this codebase has hit before); `OriginCheckGuard` present
on every mutating route, absent on every read-only route; real IDOR scoping on both
`:integrationId`-nested sub-resources (`where: { id, integrationId }` on every
`findById`/`update`/`remove`, exercised by real e2e cross-integration-404 tests);
`escapeLikePattern()` used on the `search` filter; no field anywhere in the DTOs/entities/migration
ever accepts an actual secret value (`secret_metadata` stores only `secretName`/`storageLocation`/
rotation timestamps/notes — an e2e test explicitly asserts no `value`/`secretValue` field is ever
returned); the bare `POST /webhook-events` route is RBAC-gated and existence-checks a supplied
`integrationId`; no raw `sequelize.query()` calls with interpolated user input anywhere (the only
raw SQL is static DDL in the migration).

### Status

Code review and security review both complete, all confirmed/plausible findings fixed or recorded
as accepted tracked debt. **Not yet second-role human reviewed, gated, pushed, or merged** — each
remains its own separate, explicit authorization per this project's standing "no auto-merge"
rule; the working tree is left staged but uncommitted for that review.
