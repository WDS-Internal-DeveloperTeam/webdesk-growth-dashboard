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

Built directly (not delegated) on branch `module-integrations`. Migrations `00122`
(`create-integrations` — all four tables, indexes, the `pg_trgm` GIN index on `display_name`, plain
btree indexes on every sub-resource's `integration_id` FK column) and `00123`
(`mark-integrations-in-development`) — renumbered from `00120`/`00121` after merging `origin/main`,
which had concurrently claimed those numbers for the System Settings module (PR #122). Every
internal reference (doc comments, test files, this doc) updated to match; the renumbering was
independently re-verified against a fresh local database (see "Post-merge re-validation" below).

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
- **Migration round-trip** (real database): `migrate up` → applied `00122`/`00123` cleanly;
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
  supporting index. Fixed — `integrations_updated_at_id_idx` added to migration `00122` (amended,
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

Reviewed by Jitesh D ("Approves"), gate `G4-integrations` approved, merged as
[PR #123](https://github.com/WDS-Internal-DeveloperTeam/webdesk-growth-dashboard/pull/123) (merge
commit `6d912264df6ff92b99fc74db4cfc30e3709f1e66`), verified live in production. See
`docs/project-state/module-integrations-approval-checklist.md` for the full sign-off record. No
`dashboard-web` UI existed yet as of this section — see below for its own build.

## `dashboard-web` UI

### Scope

Built directly on the explicit "Start the dashboard-web UI for it" instruction, following the
backend's own build-to-production arc. No approved wireframe exists for this module — the IA
below mirrors the real backend contract directly (routes/DTOs read first, not assumed), matching
every prior module's own "smallest honest reading" precedent for an unsourced screen.

Four routes under `app/(shell)/integrations/` (the module registry's own seeded `route` field):
list (`/integrations`), create (`/integrations/new`), detail
(`/integrations/[integrationId]`), edit (`/integrations/[integrationId]/edit`) — mirroring Brand
Library's own file layout, the closest sibling (a single primary table, no bespoke workflow, a
distinct `M`-gated toggle action).

The detail page composes: an Identity section (provider/displayName/configReference/notes/
publicId), a Status section with a new `IntegrationVerifyAction` (a `result` select +
optional `notes`, `POST /integrations/:id/verify`) and a new `IntegrationActiveToggle`
(`POST /integrations/:id/toggle-active`, mirrors `ContentTemplatePublishActions`' toggle
shape), and three real sub-resource sections mirroring `ProjectEnvironmentsSection`'s/
`ProjectRepositoriesSection`'s own established CRUD pattern:

- `IntegrationEnvironmentsSection` — full create/list/update/delete
  (`/integrations/:integrationId/environments...`).
- `IntegrationSecretMetadataSection` — full create/list/update/delete
  (`/integrations/:integrationId/secret-metadata...`) — never renders a secret value (none is
  ever returned by the backend); only `secretName`/`storageLocation`/rotation dates/notes.
- `IntegrationWebhookEventsSection` — **read-only** list only (`GET
/integrations/:integrationId/webhook-events`) — no create/update/delete UI. The backend's own
  organization-wide bare `POST /webhook-events` route (for an event arriving before it can be
  matched to a known integration) is deliberately NOT exposed as a UI form in this pass — it's a
  receiver-shaped endpoint with no real receiver wired up yet (D1, backend scope doc), and
  fabricating a manual "log a fake webhook" form adds a control surface the design doesn't call
  for. This is a deliberate, flagged scope reduction, not an oversight.

`notes`/`configReference` render as plain `<textarea>`/`<input>` fields, NOT `RichTextEditor` —
an explicit, documented exception to the 2026-08-22 standing rule: the backend's own DTOs
(`integrations.dto.ts`) never sanitize these fields as HTML (plain ops metadata, per the
backend's own design doc), so treating them as rich text on the frontend alone would be
dishonest, matching the identical, already-established exception for Ready for Claude Queue's
own long-text fields.

`create()`/`update()` treat `publicId`/`provider` as create-only (immutable after create,
matching every sibling discriminator-field convention). New `packages/shared-types` additions:
`IntegrationProvider`/`IntegrationStatus`/`IntegrationVerificationResult`/`Integration`/
`IntegrationEnvironment`/`WebhookEventProcessingStatus`/`WebhookEvent`/`SecretMetadata`,
mirroring `packages/database/src/integrations/entities.ts` exactly.

### As-built — `dashboard-web` UI

Built directly (not delegated) on branch `dashboard-web-integrations`. Every backend contract file
(`integrations.dto.ts`, all 4 controllers, `packages/database/src/integrations/entities.ts`) was
read directly before writing any frontend code, and every reference template
(`BrandLibraryForm`/`BrandLibraryPublishActions`, `ProjectEnvironmentsSection`/
`ProjectRepositoriesSection`, the Decision and Activity Log list page) was read in full before
mirroring it.

**`packages/shared-types/src/index.ts`** — appended `IntegrationProvider`/`IntegrationStatus`/
`IntegrationVerificationResult`/`Integration`/`IntegrationEnvironment`/
`WebhookEventProcessingStatus`/`WebhookEvent`/`SecretMetadata`, mirroring
`packages/database/src/integrations/entities.ts` field-for-field. The package's `dist`/`dist-cjs`
output was stale from a prior session's work (unrelated `AdminUser`/`PermissionMatrix` types were
already missing from the built output before this branch touched anything) — rebuilt via
`pnpm --filter @webdesk/shared-types build` before `dashboard-web`'s own typecheck could pass.

**`apps/dashboard-web/lib/`**:

- `integrations-query.ts` (zero non-type imports) — `PROVIDER_VALUES`/`PROVIDER_LABEL`,
  `STATUS_VALUES`/`STATUS_LABEL`/`integrationStatusBadge()`,
  `VERIFICATION_RESULT_VALUES`/`VERIFICATION_RESULT_LABEL`/`verificationResultBadge()` (a `null`
  result — "never verified" — is deliberately distinguished from the real `"unknown"` enum value),
  `integrationActiveBadge()` (mirrors `brandLibraryPublishBadge()`'s healthy/notConfigured
  reasoning), `WEBHOOK_PROCESSING_STATUS_VALUES`/`_LABEL`/`webhookProcessingStatusBadge()`,
  `IntegrationsQuery`/`parseIntegrationsSearchParams()`/`buildIntegrationsHref()` (validated
  against the real `listIntegrationsQuerySchema` enum values, matching `parseBrandLibrarySearchParams()`'s
  own defense-in-depth convention).
- `integrations.ts` — `getIntegrations()` (list, "request one row past the page size" pagination
  technique), `getIntegration()` (UUID-shape short-circuit before any network call), a
  `getIntegrationEnvironments()`/`getSecretMetadata()`/`getWebhookEvents()` trio (each capped at
  `?limit=200`, wiring the backend's own code-review-added pagination cap rather than an unbounded
  fetch), and `getIntegrationDetail()`, which fetches the integration then its three sub-resource
  lists in parallel via `Promise.all` + `tolerateDiscard()` (imported from `lib/business-knowledge.ts`,
  the established convention) with each sub-fetch independently `.catch()`-degrading to `[]` and
  `console.error`-logging — a transient failure on, say, webhook events must not crash the whole
  detail page, matching `getProjectDetail()`'s own established failure-isolation pattern.

**`apps/dashboard-web/components/`**:

- `integration-form.tsx` + `.module.css` — create/edit form. `publicId`/`provider` create-only
  (read-only on edit); `displayName` required; `configReference`/`notes` plain `<input>`/
  `<textarea>` (NOT `RichTextEditor` — the documented exception, since the backend never sanitizes
  these as HTML). `status`/`lastVerified*`/`isActive` are never form fields.
- `integration-verify-action.tsx` + `.module.css` — a `result` `<select>` (required) + optional
  `notes` textarea, `POST /integrations/:id/verify`. Always starts empty (records a NEW result,
  doesn't reflect the integration's current `lastVerificationResult`); resets and calls
  `router.refresh()` on success.
- `integration-active-toggle.tsx` + `.module.css` — a single toggle button
  (`POST /integrations/:id/toggle-active`), mirroring `BrandLibraryPublishActions`' `useSyncedState()`
  re-sync pattern; no `window.confirm()` either direction, since `isActive` has no approval-status
  gate and is freely reversible.
- `integration-environments-section.tsx` — real create/list/update/delete CRUD, file-for-file
  mirroring `ProjectEnvironmentsSection` (inline add row, inline edit with an `updatedAt`-keyed
  resync effect, `usePendingIds()` for per-row in-flight tracking). No `router.refresh()` after a
  mutation — no other section reads environment data.
- `integration-secret-metadata-section.tsx` — same CRUD shape for `secret_metadata`. Never
  renders or accepts a secret value field (the backend entity has none). `lastRotatedAt`/
  `rotationDueAt` use `type="datetime-local"` inputs converted to/from a full ISO datetime string
  via the existing shared `lib/datetime-local.ts` helpers (`toDateTimeLocalValue()`/
  `fromDateTimeLocalValue()`), since the backend's `z.string().datetime()` needs more than a bare
  date.
- `integration-webhook-events-section.tsx` — **read-only**, not a `"use client"` component (plain
  server-rendered rows). No create/update/delete UI, per the documented scope reduction — the
  backend's own bare `POST /webhook-events` receiver-shaped route is deliberately not exposed as a
  form.
- `integration-subresource-section.module.css` — shared base for the three sub-resource sections,
  mirroring `project-subresource-section.module.css`'s own shape, composing from
  `integration-form.module.css` instead of `project-form.module.css`.

**`apps/dashboard-web/app/(shell)/integrations/`** — four routes at the module registry's own
seeded `route` field (`/integrations`): `page.tsx` (list — provider/status/isActive filters,
search, offset pagination, mirroring `brand-library/page.tsx` file-for-file), `new/page.tsx`,
`[integrationId]/page.tsx` (detail — Identity/Configuration/Status sections, the verify action, the
active toggle, and the three sub-resource sections; "Edit" is always shown, since `isActive` has no
terminal state unlike an `approvalStatus` workflow), `[integrationId]/edit/page.tsx`.

**Tests** — 6 new files, 49 new tests, all independently re-run and passing:
`integrations-query.test.tsx` (20 — search-param parsing/href building/every badge-mapping
function), `integrations.test.tsx` (7 — `getIntegrations()`/`getIntegration()`'s pagination,
malformed-id short-circuit, 404/error handling), `integration-form.test.tsx` (7 — required fields,
no rich-text editor rendered, create/edit payload shape, omit-vs-null nullish contract, read-only
`publicId`/`provider` on edit), `integration-verify-action.test.tsx` (4 — required field, payload
shape, form reset + refresh on success, error handling), `integration-active-toggle.test.tsx` (6 —
label per state, no-confirm toggle, optimistic flip, prop resync, error handling),
`integration-environments-section.test.tsx` (5 — empty state, add, delete, error message,
`updatedAt`-keyed resync of an open edit form without wiping an in-progress unsaved edit).

### Validation — all commands below were actually run against this branch, real output captured

A real local checkout was used for every check; no local `dashboard-api`/database was available in
this environment (matching several prior modules' own noted limitation), so only the live-render
check below covers the unauthenticated-redirect path — the authenticated success-path rendering
was not visually confirmed, same limitation the Projects/Business-Knowledge-Center list pages'
own as-built records already noted for themselves.

- **`@webdesk/shared-types` build**: `pnpm --filter @webdesk/shared-types build` — clean
  (`tsc` + the CJS build + the CJS `package.json` writer). Required before `dashboard-web`'s own
  typecheck could resolve the new types — the package's `dist`/`dist-cjs` output was stale
  entering this branch (unrelated to this branch's own changes, see above).
- **Typecheck**: `pnpm --filter @webdesk/shared-types typecheck`,
  `pnpm --filter dashboard-web typecheck`, `pnpm --filter dashboard-api typecheck`, and
  `pnpm --filter dashboard-worker typecheck` — all four clean, 0 errors, re-run a second time after
  the prettier auto-fix pass below and still clean.
- **Lint**: `pnpm --filter dashboard-web lint` (`eslint app lib components tests
--max-warnings=0` + `node scripts/check-css-tokens.mjs`) — clean; the CSS-token check reported
  "CSS token check passed (112 CSS Module file(s) checked)" both before and after the prettier fix.
- **Prettier**: `pnpm exec prettier --check` on every file created/touched flagged 10 files on the
  first pass (real formatting drift, not a false positive — long lines/import wrapping); fixed with
  `pnpm exec prettier --write` on exactly those 10 files, then every file (23 total) re-checked
  clean.
- **Unit tests**: `pnpm --filter dashboard-web test -- --run` — **165/165 test files, 2040/2040
  tests passed**, both before and after the prettier auto-fix pass (identical counts, confirming
  the formatting change was purely cosmetic). All 6 new files individually confirmed present and
  passing in the run: `integration-form.test.tsx` (7), `integration-environments-section.test.tsx`
  (5), `integration-verify-action.test.tsx` (4), `integration-active-toggle.test.tsx` (6),
  `integrations-query.test.tsx` (20), `integrations.test.tsx` (7).
- **Production build**: `pnpm --filter dashboard-web build` — clean, `Compiled successfully`, all
  4 new routes (`/integrations`, `/integrations/[integrationId]`,
  `/integrations/[integrationId]/edit`, `/integrations/new`) present in the build's own route
  table, all dynamically (`ƒ`) rendered as expected (every route calls `getServerSession()`).
- **Live-rendered in the Browser pane** (`next dev`, no backend available): all four new routes —
  `/integrations`, `/integrations/new`, `/integrations/:id`, `/integrations/:id/edit` — confirmed
  to redirect (`307`) an unauthenticated visitor cleanly to `/auth/sign-in` (`200`), zero console
  errors, zero server errors (`preview_logs` with `level: "error"` returned "No server errors
  found").

### Independent verification and code review

Independently re-run by the orchestrating session, not trusted from the build agent's own report:
typecheck (`@webdesk/shared-types`/`dashboard-web`/`dashboard-api`/`dashboard-worker`, all 4
clean), lint + CSS-token check (clean), unit tests (165/165 files, 2040/2040 tests, matching the
agent's own count exactly), a production build (all 4 new routes present). Every component read
directly (`integration-form.tsx`, `integration-verify-action.tsx`,
`integration-active-toggle.tsx`, `integration-secret-metadata-section.tsx`,
`integration-webhook-events-section.tsx`, the detail page, the list page, `lib/integrations.ts`),
confirming: no secret value is ever rendered or accepted anywhere (`SecretMetadataFormValues` has
no such field); every mutation submits via the established `credentials: "include"` fetch pattern;
`configReference`/`notes` correctly stay plain `<input>`/`<textarea>` fields, not `RichTextEditor`
(the documented exception); the list page correctly preserves `pageSize` across a filter submit via
a hidden field (the exact bug class this app has hit and fixed before); and the sub-resource
sections mirror `ProjectEnvironmentsSection`'s own established CRUD shape.

**Reviewed at light tier**, per the 2026-08-27 "right-size the review pipeline" standing rule — a
small, frontend-only UI slice consuming an already-reviewed, already-gated backend with no new
endpoint. A direct read-through pass found **1 finding, fixed**: `getIntegrationDetail()` wrapped
each of its three sub-resource fetches in both `tolerateDiscard()` AND a `.catch()` — but the
`.catch()` alone already converts every rejection into a resolved `[]`, so the promise handed to
`tolerateDiscard()` could never reject in the first place, making the wrapper a genuine no-op
(and its own doc comment attributed the failure-isolation to the wrong mechanism). Fixed by
removing the redundant `tolerateDiscard()` import/wrapping and correcting the doc comments on
`getWebhookEvents()`/`getIntegrationDetail()` to credit the real mechanism (the per-fetch
`.catch()`). Re-validated after the fix: typecheck/lint clean, 165/165 unit test files (2040/2040
tests, unchanged — confirming the fix was behavior-preserving), prettier clean.

Security review skipped per the same standing rule — no new endpoint, no new RBAC action, no new
sink; every rendered field (including `payloadSummary`/`errorMessage` on the read-only webhook
events list) is plain JSX text, never `dangerouslySetInnerHTML`.

### Status

Built, fully validated, live-rendered, and code-reviewed (1 finding, fixed) — not yet second-role
human reviewed, gated, merged, or pushed to `origin`. Each remains its own separate,
not-yet-requested next step, matching this project's standing discipline for every prior module's
own `dashboard-web` UI slice.
