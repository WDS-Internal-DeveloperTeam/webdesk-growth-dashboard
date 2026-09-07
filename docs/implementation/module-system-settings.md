# Module: System Settings

## Scope

**Module key:** `system_settings` — already seeded in `module_registry` (migration `00035`), route
`/system-settings`, navigation group `settings`, no dependencies, `confidentialityLevel: null`.
RBAC group `system_settings` (migration `00013`): `super_admin` holds `VCERM` (view/create/edit/
review/configure), `owner_growth_approver` holds `VM` (view/configure). No submit/approve/publish
letters exist on this group.

**Canonical spec** (`03_Detailed_Module_Specifications.md §42`) is a bare list with no field-level
schema: "statuses, categories, taxonomies, file limits, scan schedules, Git rules, backup rules,
retention, contacts, escalation SLAs, documentation rules, environments."

**Scope decision, confirmed directly with the project owner (`AskUserQuestion`):** this module
owns only the genuinely unowned settings — retention (`retention_policies`/`retention_holds`,
Phase 1E), contacts (`operational_contacts`), and scan schedules (Scan Center's
`scan_definitions`) already have their own dedicated, already-live tables elsewhere in this
codebase and are explicitly OUT of scope here, to avoid a second source of truth for something
already built. In scope: default statuses/categories/taxonomies, file upload limits, Git rules,
backup rules, escalation SLAs, documentation rules, and environment definitions.

**Design decisions (D1–D5):**

- **D1 — single generic table with a `settingType` discriminator**, mirroring Business Knowledge
  Center's/Brand Library's own precedent for a heterogeneous, spec-thin content set, rather than
  7 bespoke tables. `settingType` is a closed enum matching the in-scope list above:
  `status_definition | category_definition | taxonomy_definition | file_limit | git_rule |
backup_rule | escalation_sla | documentation_rule | environment`.
- **D2 — `value` is a bounded JSONB column**, since each `settingType`'s real shape differs (a
  file limit is a byte count + allowed MIME list; a Git rule is a branch-naming pattern; an
  environment is a name + URL + type). Reuses the shared `boundedJsonObjectSchema()` helper
  (`@webdesk/validation`, introduced by Import and Export Center) with the same 50,000-byte cap —
  no per-`settingType` schema validation beyond that, since no spec exists to validate against.
- **D3 — `key` is a stable, human-assigned slug, unique per `(settingType, key)`** (not globally
  unique — `git_rule:branch-pattern` and `documentation_rule:branch-pattern` can coexist), so a
  setting can be looked up predictably instead of only by opaque UUID.
- **D4 — `isActive` is a real, orthogonal boolean gated on the `configure` action (`M`)**, not
  `edit` — mirrors the already-established publish/unpublish orthogonal-action pattern (Content
  Template Library, Brand Library). Editing a setting's `value`/`description` needs only `edit`;
  flipping `isActive` needs `configure`, matching the RBAC matrix's own real split (both seeded
  roles hold `M`, but only `super_admin` holds `E`).
- **D5 — the `review` (`R`) action is left deliberately unwired**, not fabricated a meaning. Only
  `super_admin` holds it, with no corresponding `approve` grant on any role, and nothing in the
  spec or roadmap names a review workflow for this module — matching this project's own
  established precedent of leaving a genuinely unused RBAC letter unwired rather than inventing a
  mechanism for it (Scan Center's `configure`/`M` was left similarly unwired at first for the same
  reason). Recorded here for a future reviewer, not silently dropped.

No hard delete (`ADR-0016`) — deactivation via `isActive` is the retirement mechanism, matching
every prior module's own precedent. No approval workflow, no confidentiality mechanism, no
`dashboard-web` UI in this pass — backend only, matching every prior module's own backend-first
precedent.

## As-built

Built directly (not delegated to a background agent) mirroring Brand Library file-for-file —
the closest sibling: a single generic table with a discriminator column, a simple orthogonal
boolean action field, no approval workflow, no confidentiality mechanism, reuses an
already-seeded RBAC group verbatim.

**Files created:**

- `packages/database/src/migrations/00120-create-system-settings.ts` — `system_settings` table
  (id, publicId, settingType enum, key, value JSONB, description, isActive, createdBy/updatedBy,
  timestamps), a real composite `UNIQUE(setting_type, key)` index (not partial — `isActive` is a
  config toggle, not an archival state), a `publicId` unique index, `settingType`/`isActive`/
  `updatedAt` indexes, and a `pg_trgm` GIN trigram index on `key` for search.
- `packages/database/src/migrations/00121-mark-system-settings-in-development.ts` — marks
  `module_registry.implementation_status = 'in_development'` for `system_settings`.
- `packages/database/src/system-settings/{entities,models,entity-mapping,system-setting.repository,index}.ts`
  — persistence layer. `SystemSettingRepository` has `create`/`findById`/`findByPublicId`/
  `findByTypeAndKey`/`list`/`update`/`updateActiveState`. `update()` has no CAS guard (no
  terminal-state concept exists for this module). `updateActiveState()` is a real atomic
  compare-and-swap on `(id, isActive)` with an optional `expectedIsActive` parameter, mirroring
  `BrandLibraryRecordRepository.updatePublishState()`'s conditional-`UPDATE` pattern but simpler
  (no `publishedAt`-style stamp-once timestamp to manage).
- `apps/dashboard-api/src/system-settings/{system-settings.constants,system-settings.dto,database.providers,system-settings.service,system-settings.controller,system-settings.module,system-settings.service.spec}.ts`
  — API layer.
- `packages/database/test/module-system-settings.integration.test.ts` — 22 tests against a real
  disposable PostgreSQL 17 database.
- `apps/dashboard-api/test/system-settings.e2e-spec.ts` — 21 tests against a real disposable
  database + real seeded RBAC (`super_admin`/`owner_growth_approver`/`read_only`).

**Files changed:** `packages/database/src/index.ts`, `packages/database/src/index.cjs.ts` (both
barrel exports — the documented dual-ESM/CJS-barrel caution), `apps/dashboard-api/src/app.module.ts`
(wired `SystemSettingsModule` in).

**Route shapes** (mirror Brand Library's exactly): `GET /system-settings/settings` (list),
`GET /system-settings/settings/:id` (findOne), `POST /system-settings/settings` (create, gated
on `create`), `POST /system-settings/settings/:id/update` (content edit — `value`/`description`/
`key`, gated on `edit`, never `isActive`), `POST /system-settings/settings/:id/active-state`
(the D4 toggle — body `{isActive, expectedIsActive?}`, statically gated only on `view` at the
route/`PermissionGuard` level with the real `configure` check done dynamically inside the
service, mirroring Brand Library's publish/unpublish layered-gate pattern).

**`key` is editable via `update()`** (unlike `settingType`, which is create-only/immutable) —
the scope doc's own field list didn't explicitly say either way; treated as a real content field
(like Brand Library's `title`) since D3 frames it as a human-assigned slug that should be
correctable without deleting and recreating the row. Renaming a key that collides with another
row's `(settingType, key)` pair is caught via the same `isSequelizeUniqueConstraintError()`
pattern `create()` uses, surfacing a clean 400.

**`boundedJsonObjectSchema()` discrepancy**: the scope doc (written before this build) describes
reusing a shared helper of this name from `@webdesk/validation`, "introduced by Import and
Export Center." That turned out to be inaccurate — `import-and-export-center.dto.ts` declares an
identically-shaped helper (same 50,000-byte cap) as a private, module-local function; it was
never actually promoted into `@webdesk/validation`. Rather than import a symbol that doesn't
exist, `system-settings.dto.ts` declares its own local copy, byte-for-byte matching Import and
Export Center's own cap and refinement shape, flagged in that file's own doc comment as a real
candidate for promotion into `@webdesk/validation` once a third consumer needs it (this
codebase's own "extract after the 2nd occurrence" convention) — not fixed in this pass, since
retrofitting the existing Import and Export Center call site is out of scope for a
System-Settings-only branch.

**`AuditEventType` choice**: no bespoke event type exists for a plain-config-toggle module like
this one (`user_activation`/`user_deactivation` are user-specific; `publish`/`unpublish` are a
real content-workflow concept this module doesn't have). `create()`/`update()`/
`updateActiveState()` all use `"data_change"`, distinguished by their own `action` field
(`"create"`/`"update"`/`"activate"`/`"deactivate"`) — matching how every sibling module without a
publish/approval-shaped event uses `"data_change"` for its own plain content edits.

**No `createdBy`/`updatedBy` existence validation** — mirrors Brand Library exactly: both columns
are nullable FKs (`ON DELETE SET NULL`) populated directly from the authenticated session's own
`actorUserId`, never accepted as client input, so no separate existence check is needed (unlike
`ownerUserId`-style fields on other modules, which accept an arbitrary caller-supplied user id and
do need one).

**Validation, independently run and confirmed by the orchestrating session (not delegated):**

- `pnpm --filter @webdesk/database run typecheck` — clean.
- `pnpm --filter dashboard-api run typecheck` — clean (required a fresh `pnpm --filter @webdesk/database run build` first so the new `SystemSettingRepository`/`SystemSettingEntity`/etc. exports were visible to `dashboard-api`'s own typecheck against the built package — the same "fresh build needed for a concurrently-added export to be picked up" caution this file's own Cautions section already documents).
- `pnpm --filter @webdesk/database run lint` — clean, 0 warnings (`--max-warnings=0`).
- `pnpm --filter dashboard-api run lint` — clean, 0 warnings (`--max-warnings=0`).
- `pnpm --filter @webdesk/database run test` — 28/28 unit tests passing (unchanged — no new
  package-level unit test file; the module's own unit coverage lives in `dashboard-api`'s
  service spec).
- `pnpm --filter dashboard-api run test` — 1872/1872 unit tests passing (118 test files), 20 new
  in `system-settings.service.spec.ts`.
- A real local disposable PostgreSQL 17 database (`webdesk_system_settings_dev`, created for
  this build) — `packages/database`'s integration suite:
  `module-system-settings.integration.test.ts` 22/22 passing, including two genuine concurrent-
  write races (`updateActiveState()`'s CAS guard, and the `(settingType, key)` composite unique
  index under `Promise.all`).
- The same database — `dashboard-api`'s e2e suite: `system-settings.e2e-spec.ts` 21/21 passing,
  covering the full real seeded RBAC split (`super_admin` VCERM can create/edit/toggle;
  `owner_growth_approver` VM can toggle but not create/edit; `read_only` and every other seeded
  role has no grant at all on this module and is denied everywhere), the `(settingType, key)`
  scoped-uniqueness behavior (same key legal across two different types), the 50,000-byte
  bounded-JSON rejection, the empty-patch rejection, explicit-`null`-clears-a-field semantics, the
  `expectedIsActive` CAS 409, `OriginCheckGuard`, and malformed-UUID/404 handling.
- A real migration `up`/`down`/`up` round-trip against the same database — 121 migrations
  executed, 0 pending, confirmed via `migrate-status.js` both before and after.
- `pnpm --filter @webdesk/database run validate:module-registry` — "43 modules, 21 permission
  groups, all references resolve" (unaffected — this module reuses the already-seeded
  `system_settings` RBAC group, so the permission-group count did not change).
- `pnpm audit` — "No known vulnerabilities found."
- `pnpm exec prettier --check` — clean on every new/changed file (ran `prettier --write` once
  during the build to pick up its own formatting preferences, then re-verified clean).
- The full `dashboard-api` e2e/integration suite (all files, not just this module's own) was also
  run against the same database to confirm no regression — see the session's final report for the
  exact pass count.

**Deviations from the build prompt:** none beyond the `boundedJsonObjectSchema()` sourcing
correction documented above (the prompt itself anticipated this might be inaccurate — "if any
validation step could not be run... say so explicitly," and separately instructed mirroring
Brand Library's real patterns over the scope doc's own aspirational framing where the two
diverged).

## Independent verification and review (orchestrating session, not delegated)

Every claim above was independently re-run against a fresh local disposable PostgreSQL 17
database (`webdesk_verify_system_settings`), not trusted from the build agent's own report:
`@webdesk/database` build/typecheck/lint (clean), `dashboard-api` typecheck/lint (clean, 0
warnings), `@webdesk/database` unit tests (28/28), `dashboard-api` unit tests (1872/1872), a real
migration `up` (121 migrations) then a real `down`/`down`/`up`/`up` round-trip on both `00120` and
`00121` specifically (not just the whole-suite up), `validate:module-registry` ("43 modules, 21
permission groups"), the full `packages/database` integration suite (45 files, 880/880 tests,
including `module-system-settings.integration.test.ts`), the full `dashboard-api` e2e suite (45
files, 853/853 tests) and `system-settings.e2e-spec.ts` in isolation (21/21), `pnpm audit` (0
vulnerabilities), and `prettier --check` on every new/changed file.

Every high-risk file was then read directly: `system-settings.controller.ts` (confirmed every
`@RequirePermission` decorator is method-level, never class-level; confirmed `:id/active-state`
statically gates only `view` at the route with the real `configure` check done dynamically inside
the service, mirroring Brand Library's own layered publish/unpublish gate exactly);
`system-settings.service.ts` (confirmed `update()` never accepts `isActive`; confirmed
`updateActiveState()` calls `assertAllowed(..., "configure")` before the write; confirmed the CAS
guard and both `isSequelizeUniqueConstraintError()` catches); `system-setting.repository.ts`'s
`updateActiveState()` (confirmed a real, sound compare-and-swap: an optional `expectedIsActive`
folded into the `WHERE` clause, disambiguating `not_found` from `conflict` via a follow-up read
when the conditional `UPDATE` affects 0 rows); `00120-create-system-settings.ts` (confirmed the
composite `(setting_type, key)` unique index is non-partial, matching D3's own stated reasoning);
`system-settings.dto.ts` (confirmed `limit` is capped at 200, not 100 — the exact cap-too-low bug
class that caused a real production incident on Decision and Activity Log); the repository's
search filter (confirmed real reuse of `escapeLikePattern()`, not a hand-rolled `LIKE`); and both
`packages/database/src/index.ts`/`index.cjs.ts` barrel exports (confirmed both were updated — the
exact omission that caused the 2026-08-12 production outage).

**Reviewed at light tier**, per the 2026-08-27 "right-size the review pipeline" standing rule —
justified here by the module's own genuinely low complexity (a single generic table, no approval
workflow, no confidentiality mechanism, no cross-module FK/relationship, reuses an already-seeded
RBAC group verbatim with zero new grants) rather than an 8-angle finder-agent fan-out. The direct
read-through above, covering every file where a real defect class has previously shipped in this
codebase (RBAC decorator placement, CAS races, unique-constraint TOCTOU handling, barrel-export
omissions, pagination cap regressions), found **0 findings**. A separate `security-review` skill
run was skipped for the same reason — no new endpoint class beyond standard CRUD, no new sink, and
every security-relevant mechanism in this diff (`OriginCheckGuard`, `ParseUUIDPipe`, method-level
RBAC, `escapeLikePattern()`, the CAS guard) is a direct reuse of an already-audited pattern.
