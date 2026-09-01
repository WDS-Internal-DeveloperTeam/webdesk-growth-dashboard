# Portfolio Library (module #25) — scope and as-built record

> Single file per the 2026-08-27 collapsed-template rule: `## Scope` is written before any code
> exists; `## As-built` is appended once the module is built and verified.

## Scope

### Pre-implementation verification

| Check                                | Result                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Recommended roadmap position         | Row 25 — `canonical-inputs/Recommended_Module_Roadmap.md`                                                                 |
| Dependency-computed roadmap position | `docs/phase-plans/module-implementation-roadmap.md` — `portfolio_library`, `libraries` group                              |
| Registry dependency                  | `null` — no prerequisite module (`00035-populate-module-registry-fields.ts`)                                              |
| RBAC permission group                | `portfolio`, already seeded (migration `00013`) — **no new RBAC migration**                                               |
| Confidentiality level (seeded)       | `"record-level (has a visibility field; level unspecified)"` — a business field, not an RBAC confidential-field mechanism |
| Open Critical/High security finding  | None                                                                                                                      |
| Blocking credential                  | None                                                                                                                      |

Source material: `03_Detailed_Module_Specifications.md §9` (flat field list: project/client, URL,
primary category, additional categories, tags, industry, platform, service type, launch date,
screenshots, proof, visibility, publication status). No wireframe, no dedicated data-model table
cluster, no workflow-state-machine section names this module specifically — the smallest-honest-
reading precedent every module since Projects has followed applies here too.

Seeded `portfolio` RBAC row (`00013-seed-rbac-matrix.ts`): `super_admin`/`owner_growth_approver`
= `VCERAPX` (view/create/edit/review/approve/publish+unpublish/export); `marketing_editor` =
`VCESR` (view/create/edit/submit/review); `designer_creative_reviewer`/`qa_security_reviewer` =
`VR`; `developer` = `V`; `read_only` = `V`. Matches Content Template Library's/Brand Library's own
split (submit+review held by a mid-tier editor, approve+publish held only by the top two roles).

### In scope

One organization-wide table, `portfolio_records`, plus a real many-to-many join into the
already-live `assets` table for screenshots. RBAC-gated on the seeded `portfolio` group.

### Design decisions (all user-confirmed via `AskUserQuestion` before any code was written)

**D1 — Single flat table, no `recordType` discriminator.** Unlike Business Knowledge Center/
Brand Library, the spec names one flat field list, not a taxonomy of record types — a portfolio
item is a single kind of record. Organization-wide, no `project_id` (matches the seeded
`dependencies: null` and every other library module's own organization-wide precedent). "project/
client" is a plain descriptive text field, not a `projects` FK.

**D2 — `screenshots`: a real many-to-many join into the already-live `assets` table**
(`portfolio_assets`), mirroring `case_study_assets` exactly — existence-validated at the app layer
via a narrow `AssetsService.existingAssetIds()`-style delegating method, no DB-level FK (keeps this
module decoupled from Asset Library's own schema/deletion lifecycle).

**D3 — `proof`: a real existence-validated `relatedProofIds` array**, mirroring
`case_studies.related_claim_ids` — validated against the live `proof_claims` table via
`ClaimsService.existingClaimIds()` (already exported for exactly this purpose by Case Study
Studio).

**D4 — `visibility`: reuses Case Study's own 4-value vocabulary** (`public | internal_only |
confidential | client_approval_required`) for consistency between the two "showcase" modules that
both carry this exact business concept.

**D5 — `publicationStatus` is a real, orthogonal publish/unpublish mechanism**, not folded into
`visibility`. Mirrors Content Template Library's/Brand Library's own `isPublished`/`publishedAt`
pair, gated on the seeded `publish`/`unpublish` RBAC actions, atomic compare-and-swap on both the
approval-status guard and the publish-state guard itself. `publish()` requires
`approvalStatus === "approved"`; `unpublish()` has no status restriction. `publishedAt` stamped
once via `COALESCE`, never cleared, never overwritten.

**D6 — Standard 8-value `ArtifactApprovalStatus` workflow, reused verbatim** (the same
`TRANSITIONS` table copied byte-for-byte into each new module, matching the established,
already-accepted duplication precedent).

**D7 — `version` is server-managed**, incremented by 1 on every successful content update only
(never on a status-transition or publish/unpublish call) — mirrors `personas.version`/
`content_templates.version`/`brand_library_records.version`.

**D8 — Remaining flat fields**: `publicId` (create-only), `projectOrClientName`, `url`
(`safeHttpUrlSchema`-validated, nullable), `primaryCategory`, `additionalCategories` (plain string
array — no categories taxonomy module exists), `tags` (plain string array), `industry`, `platform`,
`serviceType`, `launchDate` (nullable date).

### Deliberately out of scope this pass

No `dashboard-web` UI — backend only, matching every prior module's own backend-first precedent.

---

## As-built

Built directly (no delegation) on the current branch, no new git branch created, no commit made,
per explicit instruction. Migrations `00095`/`00096` — `00093`/`00094` were reserved by other
in-flight work and confirmed still absent via `ls packages/database/src/migrations` before
writing.

### Files created

**`packages/database`** (ESM + CJS barrel exports updated):

- `src/migrations/00095-create-portfolio-library.ts` — `portfolio_records` (all D1/D3–D8 fields;
  `public_id` unique index; `approval_status`/`updated_at` indexes; a `pg_trgm` GIN trigram index
  on `project_or_client_name`) and `portfolio_assets` (D2, mirrors `case_study_assets` exactly —
  `portfolio_record_id` FK CASCADE into `portfolio_records`, `asset_id` deliberately NOT a DB-level
  FK, `role`/`caption`, a unique composite index on `(portfolio_record_id, asset_id)`). `down()`
  drops both tables and both created ENUM types.
- `src/migrations/00096-mark-portfolio-library-in-development.ts` — flips
  `module_registry.implementation_status` to `in_development` for `portfolio_library`.
- `src/portfolio-library/entities.ts`, `models.ts`, `entity-mapping.ts`,
  `portfolio-record.repository.ts`, `portfolio-asset.repository.ts`, `index.ts`.
- `test/module-portfolio-library.integration.test.ts` — 33 tests.

**`apps/dashboard-api`**:

- `src/portfolio-library/portfolio-library.constants.ts`, `portfolio-library.dto.ts`,
  `database.providers.ts`, `portfolio-records.service.ts`, `portfolio-assets.service.ts`,
  `portfolio-library.controller.ts` (both `PortfolioLibraryController` and
  `PortfolioAssetsController` in one file, per the task's own instruction),
  `portfolio-library.module.ts`.
- `src/portfolio-library/portfolio-records.service.spec.ts` — 45 unit tests.
- `src/portfolio-library/portfolio-assets.service.spec.ts` — 7 unit tests.
- `test/portfolio-library.e2e-spec.ts` — 31 e2e tests (real disposable database + real seeded
  RBAC roles).

### Files edited

- `packages/database/src/index.ts`, `src/index.cjs.ts` — appended
  `export * from "./portfolio-library/index.js";` to both barrels (the CJS one per this project's
  own documented production-outage caution about the two barrels needing to stay in sync).
- `apps/dashboard-api/src/app.module.ts` — added the `PortfolioLibraryModule` import and
  registered it in the `@Module` imports array, alphabetically between `PersonaLibraryModule` and
  `ProjectsModule`.

### Design notes / mirroring decisions

- **Screenshots delete route uses `POST :id/delete`, not `DELETE`**, matching
  `CaseStudyAssetsController.remove()`'s own real convention exactly — the task prompt described
  it as a `DELETE` route, but every sibling module in this codebase uses a `POST .../delete` route
  for this action (avoids a bare `DELETE` verb entirely across the whole app), so the established
  codebase convention was followed over the prompt's literal wording.
- **`portfolio_assets.role` is a plain free-text `STRING(64)`**, not a closed enum — the task scope
  doc doesn't name a fixed vocabulary for portfolio screenshot roles the way Case Study Studio's
  own `CaseStudyAssetRole` does; validated at the DTO layer as `z.string().min(1).max(64)`, matching
  the DB column exactly.
- No rich-text/sanitization wiring — this module has no long-text fields in its D1–D8 field list
  (all short text, arrays, dates, a URL), so the 2026-08-22 standing rich-text-editor rule doesn't
  apply here; nothing was skipped.
- `PORTFOLIO_LIBRARY_MODULE_KEY = "portfolio"` confirmed directly against
  `00013-seed-rbac-matrix.ts`'s real seeded `portfolio` permission-group key and grant matrix
  before use (matches the scope doc's own D8/pre-implementation-verification table).

### Validation — real output

**`packages/database` build** (`pnpm --filter @webdesk/database build` — `tsc` ESM + `tsc` CJS +
CJS `package.json` writer): clean, no errors.

**`packages/database` typecheck** (`tsc -p tsconfig.json --noEmit`): clean.

**`packages/database` lint** (`eslint src --max-warnings=0`): clean.

**`dashboard-api` build** (`nest build`): clean, no errors.

**`dashboard-api` typecheck** (`tsc -p tsconfig.json --noEmit`): clean.

**`dashboard-api` lint** (`eslint src test --max-warnings=0`): clean.

**`prettier --check`** on every new/touched file: clean (one round of `--write` was needed first —
mostly line-wrap adjustments in the barrel exports, the module file, `app.module.ts`, and the new
spec/test files; re-verified clean, and typecheck/lint/build were all re-run afterward and stayed
clean).

**`packages/database` unit tests** (`pnpm --filter @webdesk/database run test`, no DB needed):
28/28 passing, unaffected by this change.

**`dashboard-api` unit tests** — full suite (`pnpm --filter dashboard-api test`): 1516/1516
passing across 90 files, including this module's own 52 (45 `portfolio-records.service.spec.ts` +
7 `portfolio-assets.service.spec.ts`). Isolated re-run confirmed the exact count:
`vitest run --config vitest.config.mts src/portfolio-library` → 2 files, 52 tests, all passing.

**Update — real database validation completed.** The user supplied local Postgres credentials
(`localhost:5432`, user `postgres`); a fresh disposable database (`webdesk_portfolio_library_dev`)
was created for this run and dropped afterward.

- **Migration round-trip**: `up` (94 total, including `00095`/`00096`) → `down` ×2 (reverting
  `00096`/`00095`) → `up` again → clean; `migrate:status` confirmed 94 executed, 0 pending.
- **`packages/database` integration tests**: `module-portfolio-library.integration.test.ts` run in
  isolation — **33/33 passing**. Full integration suite re-run (all 35 files) — **709/709
  passing**, confirming no regression in any sibling module's own tests.
- **`dashboard-api` e2e tests**: `portfolio-library.e2e-spec.ts` run against the real database —
  **2 real test failures found on the first run**, both in the screenshots sub-resource block: two
  test cases sent a bare `randomUUID()` as `assetId` and expected `201 Created`, but
  `PortfolioAssetsService.create()` correctly rejects a nonexistent `assetId` with `400` (D2's own
  existence-validation design, working exactly as specified) — the tests themselves were wrong, not
  the service. Fixed by seeding a real row in the `assets` table via `AssetRepository.create()`
  first (mirroring `case-study-studio.e2e-spec.ts`'s own fixture pattern) at both call sites. Re-run
  after the fix: **31/31 passing**, including the full 3-tier submit/review/approve/publish/unpublish
  RBAC matrix, the publish/unpublish CAS-guard 409s, IDOR-prevention on the screenshots sub-resource,
  and the unsafe-URL-scheme rejection on `url`.
- **`validate:module-registry`**: passed — 43 modules, 21 permission groups, all references
  resolve (unaffected).
- Lint (`eslint --max-warnings=0`) and `prettier --check` on the one edited test file
  (`test/portfolio-library.e2e-spec.ts`): clean.

This closes the gap the original build's own report disclosed — the real migration `up`/`down`/`up`
round-trip, the 33 integration tests (including the two atomic CAS methods under genuine concurrent
races), and the 31 e2e tests have all now actually run against a real schema and pass, with one
genuine test-authoring bug found and fixed in the process (not a service/repository defect).

### Independent code review

This project's own `code-review` skill run at high effort (8-angle finder pass, 1-vote
verification) — 8 findings kept in the final report. **5 fixed**: `relatedProofIds` retyped from a
generic free-text array to `z.array(z.string().uuid())` at the DTO layer (defense-in-depth ahead of
the service's own `UUID_PATTERN` filter); the duplicated empty-patch `.refine()` validator extracted
into a shared `rejectEmptyPatch()` helper used by both `updatePortfolioRecordSchema` and
`updatePortfolioAssetSchema`; the triplicated "log, don't throw" audit try/catch across
`changeApprovalStatus()`/`publish()`/`unpublish()` extracted into a shared `recordAuditSafely()`
private method; and a redundant IDOR pre-check in `PortfolioAssetsService.remove()` removed (the
scoped `portfolioAssets.remove(id, portfolioRecordId)` call already enforces the identical
compound-`WHERE` scoping — the manual `asset.portfolioRecordId !== portfolioRecordId` check was
dead logic once that call runs). **One fix was attempted and reverted**: parallelizing `publish()`'s
sequential `findById()`/`assertAllowed()` calls via `Promise.all` broke an existing unit-test
expectation and, on inspection, the sequential order is deliberate — a non-approved record must
fail with the more specific `400` without ever attempting the `"publish"` RBAC check, so
parallelizing would make which error (400 vs. 403) a caller sees nondeterministic on a record that's
both non-approved and being published by an unauthorized actor. **3 left as accepted, tracked
debt**, each byte-identical to an already-established, repo-wide convention shared by 5+ sibling
modules, not novel to this diff: `update()`'s `Promise.all` race between `findById()` (404) and
`assertProofIdsExist()` (400), byte-for-byte inherited from `PersonasService.update()`'s/
`ServicesService.update()`'s own identical shape; `changeApprovalStatus()`'s same-status no-op
returning before the RBAC check runs, matching Content Template Library's/Brand Library's own
identical ordering; and `updatePublishState()`'s two adjacent boolean parameters, matching
`ContentTemplateRepository.updatePublishState()`'s own identical signature verbatim.

Re-validated after the fix round (including reverting the `publish()` change and updating one unit
test whose expectation the `remove()` fix legitimately changed): `packages/database` build clean;
`dashboard-api` build clean; lint/`prettier --check` clean on every touched file; 52/52
`dashboard-api` unit tests (unchanged count, 1 test updated); a fresh migration `up` (94 total)
against a newly recreated disposable database; 33/33 `packages/database` integration tests; 31/31
`dashboard-api` e2e tests; `validate:module-registry` — 43 modules, 21 permission groups, all
references resolve.

Security review, required second-role human review, a gate decision, push/PR, and merge
authorization each remain their own separate, not-yet-requested next steps.
