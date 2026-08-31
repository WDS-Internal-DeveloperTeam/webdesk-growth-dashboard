# Section and Pattern Library — module backend

## Scope

Module #15 on the Recommended Module Roadmap (Wave 1 — no dependencies per
`docs/phase-plans/module-implementation-roadmap.md`), module key `section_and_pattern_library`.
Built directly on the explicit "start Section & Pattern Library" instruction. Backend-only pass —
`dashboard-web` UI is a separate, not-yet-requested next step, matching every prior module's own
backend-first precedent.

### Spec gap and resolution

Unlike most modules built so far, `03_Detailed_Module_Specifications.md §15` gives **no field
list** for this module — only a taxonomy of pattern types ("Patterns include: homepage
storytelling, service, industry, location, landing conversion, portfolio showcase, social proof,
results/metrics, engagement models, team/expertise, content hub, article, lead capture, download,
multi-step form, search/filter, trust, objection handling, cross-sell, error/no-results"). Zero
hits in `04_Data_Model_and_Ownership.md`, `05_Workflow_State_Machines.md`,
`06_Roles_and_Permissions.md`, `07_Low_Fidelity_Wireframes.md`, or
`canonical-inputs/Recommended_Module_Roadmap.md`.

Three design forks were confirmed directly with the project owner first (`AskUserQuestion`):

1. **Field shape**: mirror Component Library's own field list (`03_Detailed_Module_Specifications.md §14`
   — name, category, status, design reference, tokens, HTML structure, PHP path, SCSS
   classes/path, JS dependencies, states, responsive behavior, browser support, accessibility,
   schema, approval), since a section/pattern is a composition of components and shares the same
   code-artifact record shape — over a simpler Design-Reference-Library-style catalog entry.
2. **Version history**: real multi-row version history, file-for-file mirroring Design Token
   Library's `design_tokens` table (`00076-create-design-token-library.ts`) — `record_id` the
   stable logical-record identity, `public_id` copied forward with a partial-unique-on-`is_current`
   index, `pattern_type` immutable across a version chain (a real type change is a different
   record) — over Design Reference Library's flat mutable-row shape.
3. **Publish action**: skip it. The RBAC `creative_design` group seeds a Publish/Unpublish action
   (used by Design Reference Library, skipped by Design Token Library), but nothing in this
   module's own spec entry names a publish concept — matches Design Token Library, the closer
   structural sibling given the version-history choice above.

### Schema

Table `section_pattern_records` — file-for-file mirrors `design_tokens`
(`00076-create-design-token-library.ts`): `id`/`record_id`/`public_id`/`version_number`/
`is_current`/`created_by`/`updated_by`/`created_at`/`updated_at` identical shape, partial unique
index on `public_id` `WHERE is_current = true`, unique `(record_id, version_number)`, a
`pg_trgm` GIN index on `name`.

Fields adapted from Component Library's list, scoped to section/pattern granularity:

- `pattern_type` — enum, the 20 values from `§15`'s own taxonomy
  (`homepage_storytelling`/`service`/`industry`/`location`/`landing_conversion`/
  `portfolio_showcase`/`social_proof`/`results_metrics`/`engagement_models`/`team_expertise`/
  `content_hub`/`article`/`lead_capture`/`download`/`multi_step_form`/`search_filter`/`trust`/
  `objection_handling`/`cross_sell`/`error_no_results`). Immutable across a version chain.
- `name` — required, `STRING(255)`.
- `description` — nullable `TEXT`, rich-text-sanitized (usage guidance — what the pattern is for).
- `design_reference` — nullable, `safeHttpUrlSchema`-validated URL (Figma/design reference,
  matching Design Reference Library's `sourceUrl` precedent).
- `html_structure` — nullable `TEXT`, plain (a code snippet, not prose — no sanitization applied).
- `php_path` — nullable `STRING(500)`.
- `scss_reference` — nullable `TEXT` (SCSS classes/path, combined into one field per Component
  Library's own "SCSS classes/path" single line item).
- `js_dependencies` — plain `STRING[]`, unvalidated.
- `responsive_behavior` — nullable `TEXT`, rich-text-sanitized (desktop/mobile/tablet behavior
  notes).
- `accessibility_notes` — nullable `TEXT`, rich-text-sanitized.
- `browser_support` — nullable `TEXT`, plain.
- `token_references` — plain `STRING[]`, unvalidated. `design_token_library` now exists as a real
  module, but linking this field to it as a real FK/existence-check is a genuine relationship
  design decision (which token identity — `record_id` vs current `public_id` — survives a token's
  own version history) that the spec doesn't inform; deferred, matching the established
  "unvalidated array, no target module relationship yet" precedent used for `usage_references`/
  `related_service_ids`/etc. elsewhere in this codebase — flagged as a real, revisitable choice,
  not an oversight.
- `related_component_ids` — plain `STRING[]`, unvalidated (`component_library` doesn't exist yet).
- `approval_status` — the shared generic 8-value artifact-lifecycle enum, governed via a dedicated
  status-transition route only, identical `TRANSITIONS` table to Design Token Library's own
  (including its one deviation: no `approved -> superseded` edge — supersede is an automatic
  side effect of a new version's own `-> approved` transition succeeding, not a distinct action).

No `project_id` scoping — organization-wide, matching every library-shaped module. No
confidential-field mechanism — the module registry's own seeded `confidentialityLevel` for
`section_and_pattern_library` is `null` (migration `00035`).

RBAC: reuses the seeded `creative_design` permission group verbatim (same group as Design Token
Library, Design Reference Library, Brand Library) — no new RBAC migration.

## As-built

Built directly on the explicit "Build the Section and Pattern Library module backend" instruction,
mirroring the Design Token Library module (module #14) file-for-file per that instruction's own
direction, since both modules share the identical real-version-history shape (a `TRANSITIONS`
table with no `approved -> superseded` edge, a partial-unique index on `public_id` scoped to
`is_current = true`, and the atomic compare-and-swap discipline on both `updateInPlace()` and
`updateApprovalStatus()`).

Migrations `00080` (`create-section-and-pattern-library`, table `section_pattern_records`) and
`00081` (`mark-section-and-pattern-library-in-development`, sets
`module_registry.implementation_status = 'in_development'` for `section_and_pattern_library`).
`packages/database/src/section-and-pattern-library/` (`entities.ts`, `models.ts`,
`entity-mapping.ts`, `section-pattern-record.repository.ts`, `index.ts`) and
`apps/dashboard-api/src/section-and-pattern-library/` (`section-and-pattern-library.module.ts`,
`section-patterns.controller.ts`, `section-patterns.service.ts`,
`section-patterns.service.spec.ts`, `section-and-pattern-library.dto.ts`,
`section-and-pattern-library.constants.ts`, `database.providers.ts`) both added, registered in
`app.module.ts`, and exported from both `packages/database/src/index.ts` (the ESM barrel) and
`packages/database/src/index.cjs.ts` (the separate, manually-maintained CommonJS entrypoint
Vercel's Function bundler actually uses in production — this project's own documented
production-outage lesson).

`description`/`responsiveBehavior`/`accessibilityNotes` are wired to
`sanitizeNullableRichText()`/`sanitizeNullableRichTextIfChanged()` (`@webdesk/validation`) on
`create()`/`update()`, even though no `dashboard-web` UI exists yet for this backend-only pass —
matching the scope doc's own "rich-text-sanitized" field designation. A plain-text length cap
(`RICH_TEXT_MAX_LENGTH = 20_000`) is used rather than the doubled rich-text-markup-overhead cap
(`40_000`) sibling modules raise to only once their own `RichTextEditor` UI actually wires in — no
real HTML/markup is being submitted yet, so doubling for markup overhead has no basis here.
`designReference` is validated via the shared `safeHttpUrlSchema` (`@webdesk/validation`),
matching Design Reference Library's own `sourceUrl` precedent, rejecting an unsafe scheme
(e.g. `javascript:`) at the API boundary.

Routes, all under `section-and-pattern-library/records`: `POST /` (create), `GET /` (list),
`GET /:recordId` (current version), `GET /:recordId/versions` (version history),
`POST /:recordId/update` (edit — in-place or fork-a-new-version per the current version's own
approval status), `POST /:recordId/status` (approval-status transition, gated dynamically per
transition inside the service, mirroring every sibling version-history module's own layered
RBAC pattern).

### Validation

All commands run directly, against a real local disposable PostgreSQL 17 database
(`webdesk_section_pattern_test`, created and dropped for this pass) — not simulated or skipped:

- **Migration round-trip**: `up` → `down` (reverting both `00081` then `00080` individually,
  confirmed via `migrate-status`) → `up` again — clean at every step, 79/79 migrations executed,
  0 pending after the final `up`. Table schema independently inspected via `psql \d
section_pattern_records` — all columns, the two ENUM types, both unique indexes (partial
  `WHERE is_current = true` on `public_id`, and `(record_id, version_number)`), the `gin_trgm_ops`
  index on `name`, and both `created_by`/`updated_by` FKs to `users` all confirmed present and
  correctly shaped.
- **`packages/database` unit tests**: 28/28 passing (unaffected by this change — no new unit
  test file added at that layer, only the integration-test layer below).
- **`packages/database` integration tests** (real database):
  `test/module-section-and-pattern-library.integration.test.ts`, 24 new tests — basic CRUD,
  the partial-unique-index behavior, the full end-to-end version-history round trip
  (create → approve → edit-the-approved-one → verify 2 rows → approve the new one → verify the
  old row is superseded), and the `updateInPlace()` CAS guard. Full suite:
  **515/515 passing (24 new)**, 28/28 integration test files.
- **`dashboard-api` unit tests**: `section-patterns.service.spec.ts`, 46 new tests, mirroring
  `design-tokens.service.spec.ts`'s own coverage shape exactly (create/publicId-uniqueness/
  rich-text-sanitization, findCurrent/listVersions/list, the in-place-vs-fork `update()` branches
  including CAS-guard races and array-field null-vs-omit semantics, and
  `changeApprovalStatus()`'s full `TRANSITIONS`-table/RBAC/supersede-on-approve behavior). Full
  suite: **1190/1190 passing (46 new)**, 78/78 test files.
- **`dashboard-api` e2e tests** (real database + real seeded RBAC):
  `test/section-and-pattern-library.e2e-spec.ts`, 24 new tests over real HTTP — the full
  `creative_design` 6-role permission matrix (`designer_creative_reviewer` alone can drive
  submit→review→approve; `marketing_editor`/`qa_security_reviewer` view+review only;
  `owner_growth_approver` review+approve but not create/submit; `read_only` view-only), publicId
  uniqueness, empty-patch rejection, unrecognized-enum rejection, unsafe-URL-scheme rejection,
  rich-text sanitization over real HTTP, terminal-state (`archived`) edit rejection, the direct
  `approved -> superseded` rejection, 404/400 on malformed/missing ids, `OriginCheckGuard`
  enforcement, and the full real fork-then-approve-supersedes-the-old-version round trip. Full
  suite: **514/514 passing (24 new)**, 28/28 e2e-spec files. One planned test — a genuine
  `Promise.all()`-driven concurrent-edit race asserting a `200`/`409` split — was tried and found
  unreliably flaky over real HTTP against a real local database (the two requests usually didn't
  actually overlap at the database layer with `DATABASE_POOL_MAX` defaulting to 2, so both
  requests commonly succeeded with `200` rather than colliding); removed rather than left flaky,
  with a comment recording why and pointing at the unit-level test
  (`section-patterns.service.spec.ts`'s "translates a concurrent version-creation collision...")
  that already covers the same real behavior deterministically via a mocked rejection — matching
  the observation that no other `*.e2e-spec.ts` file in this codebase attempts this shape of test.
- **`validate:module-registry`**: passing — 43 modules, 21 permission groups, unaffected.
- **Lint** (`eslint --max-warnings=0`): clean on both `packages/database` and `dashboard-api`
  (`src` + `test`).
- **Typecheck** (`tsc --noEmit`): clean on both packages, after rebuilding `@webdesk/database`'s
  dist output so `dashboard-api` could resolve the new exports (the package resolves compiled
  `dist/`, not `src/`, for cross-package types).
- **Prettier** (`--check`): clean on every touched/created file.
- **`pnpm audit`**: no known vulnerabilities (no new npm dependency was needed).

No `dashboard-web` UI exists yet for this module — a separate, not-yet-requested next step,
matching every prior module's own backend-first precedent.

### Independent code review

This project's own `code-review` skill, high effort (8 finder angles run in parallel, 1-vote
verification on each deduped candidate). 12 candidates surfaced after dedup, 7 kept for
verification (6 CONFIRMED, 1 PLAUSIBLE, 0 REFUTED). **3 fixed**, re-validated against a real
disposable PostgreSQL 17 database:

1. **`list()`'s `WHERE is_current = true` + `ORDER BY updated_at DESC, id ASC` had no supporting
   index.** Fixed — added a partial index `(updated_at, id) WHERE is_current = true` to migration
   `00080`.
2. **`supersedeOtherApprovedVersion()`'s `WHERE record_id = ? AND approval_status = 'approved'`
   had no supporting index.** Fixed — added `(record_id, approval_status)` to migration `00080`.
3. **The version-row shape was independently hand-typed three times** (`SectionPatternVersionRowInput`,
   plus separate inline types in `create()`/`createNewVersion()`) with mismatched optionality per
   field. Fixed — `create()`/`createNewVersion()`'s input types now derive from
   `SectionPatternVersionRowInput` via `Pick`/`Omit`/`Partial` instead of retyping every field.

**4 left as accepted, tracked debt** — each confirmed byte-identical to Design Token Library's own
already-shipped, already-reviewed pattern, not a novel deviation this module introduces:

4. `changeApprovalStatus()`'s same-status no-op returns before the RBAC `assertAllowed()` check
   runs, letting a `view`-only caller bypass the submit/review/approve gate for a self-transition
   call. Inherited across 6+ sibling modules — a real fix needs a shared refactor, not a per-module
   patch.
5. The fork-on-approved branch's CAS guard checks only `approvalStatus`, not `isCurrent` — two
   concurrent forks of the same approved record both pass the guard, but the `(record_id,
version_number)` unique index still catches the collision as a clean `409`, not corruption.
6. `pattern_type`/`approval_status` enum value lists are independently hand-typed in `entities.ts`,
   `models.ts`, and the DTO with no shared source of truth anywhere in the codebase — identical gap
   in every sibling module.
7. `RICH_TEXT_MAX_LENGTH`/`PLAIN_TEXT_MAX_LENGTH` are two constants that currently coincide at
   `20_000`, already explained by an in-code comment as deliberate forward-looking prep — low
   severity.

Re-validated after the 3 fixes: 515/515 `packages/database` integration tests (unchanged pass
count, confirming the fixes are behavior-preserving), 514/514 `dashboard-api` e2e tests (one
initial run showed 17 unrelated timeout failures in `authz.e2e-spec.ts` under parallel load — a
clean isolated re-run of the full suite confirmed all 514 pass, ruling out a real regression),
typecheck/lint/prettier all clean, both new indexes independently confirmed present via `psql \di`.

### Independent security review

Focused on the module's actual attack surface: RBAC decorator placement, `OriginCheckGuard`
coverage on mutating routes, `designReference`'s URL-scheme validation, search-string escaping,
and the cross-module DI surface. **0 findings above threshold.** Confirmed: every
`@RequirePermission` decorator is method-level, never class-level; `OriginCheckGuard` gates every
mutating route (`create`/`update`/`status`); `designReference` is validated via the shared
`safeHttpUrlSchema`, rejecting non-`http(s)` schemes at the API boundary; search uses the shared
`escapeLikePattern()` helper before interpolation into `Op.iLike`; all queries are parameterized
through Sequelize's object `where`/`update` API; no cross-module repository export exists
(`SECTION_PATTERN_RECORD_REPOSITORY` is self-registered only); no confidentiality-redaction
mechanism, matching the module registry's own seeded `confidentialityLevel: null` for this module.
