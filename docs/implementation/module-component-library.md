# Component Library module

## Scope

The Component Library module — module #17 on the Recommended Module Roadmap
(`canonical-inputs/Recommended_Module_Roadmap.md`), sourced from
`webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md §14` and
`04_Data_Model_and_Ownership.md:149-150`. A catalog of reusable UI component records for the
**WordPress website** deliverable (navigation, heroes, buttons, cards, forms, proof bars, and
~35 more named categories, per the spec's own non-exhaustive list) — HTML/PHP/SCSS/JS
implementation details, design-token bindings, accessibility notes, and an approval workflow.
Built directly on the explicit "Build the Component Library module backend" instruction,
mirroring Design Token Library (module #16, the immediately preceding module, same
`creative_design` RBAC domain and Component Library's own real seeded `dependencies` target —
`00035-populate-module-registry-fields.ts:250`) file-for-file as the structural template.

### Design decisions

**D1 — real multi-row version history, single physical table (not two).** The data-model doc
names two tables (`components`, `component_versions`) — but it names the identical two-table
shape for Design Token Library too (`design_tokens`, `design_token_versions`), and that module's
own real build collapsed them into ONE physical table (`design_tokens`) using the row-per-version
pattern (`recordId` groups every version of the same logical record; `isCurrent` flags exactly
one row per `recordId`). Since this is the immediate, already-reviewed precedent for the identical
doc-naming ambiguity, `components` follows the same single-table pattern rather than the doc's
literal two-table split — every version is its own physical row in `components`, matching
`design_tokens`'s/`website_strategy_records`'s own established shape exactly, including the
partial-unique-index-on-`is_current` discipline for `public_id` uniqueness, the
`(record_id, version_number)` uniqueness, `category`/`replacementRecordId` immutability
discussion below, and `changeApprovalStatus()`'s automatic-supersede-on-approve mechanism (no
direct `approved -> superseded` transition; supersede is a side effect of a NEW version's own
approval).

**D2 — `tokens` field: a REAL, existence-validated relationship into `design_tokens`.** Stored as
`tokenIds: string[]` (an array of Design Token Library `recordId`s — the token's stable logical
identity across its own version chain, not a specific version row's `id`, since a component
should always resolve to "whichever version of this token is current"). Validated via a new
narrow, read-only `DesignTokensService.existingTokenIds()` delegating method (mirroring
`ServicesService.existingServiceIds()`'s own already-reviewed pattern — added rather than
exporting the write-capable `DESIGN_TOKEN_REPOSITORY` token across the module boundary, the exact
"surface grows" condition Persona Library's own security review flagged once already), backed by
a new `DesignTokenRepository.findByIds(recordIds)` (queries `WHERE recordId IN (...) AND
isCurrent = true`, mirroring `ServiceRepository.findByIds()`'s shape). `ComponentLibraryModule`
imports `DesignTokenLibraryModule` for its exported `DesignTokensService`.

**D3 — `states` field: plain nullable long text**, not a structured child table — component
interaction/variant states (hover, focus, disabled, loading, empty, etc.) described in prose/list
form, matching every sibling module's own "no structured sub-shape without a sourced reason"
precedent. Sized `TEXT` (unbounded at the DB layer, capped at 4,000 chars at the DTO layer — the
same cap class Persona Library/Service Library's rich-text-eligible fields use) so a future
`RichTextEditor` conversion (per the 2026-08-22 standing rule, once a `dashboard-web` UI exists)
needs no migration.

**D4 — code fields are plain text, not rich text.** `htmlStructure`, `phpPath`,
`scssClassesPath`, `jsDependencies` are short factual strings/paths/lists (matching Page
Inventory's `desktopBehavior`/`mobileBehavior` precedent for factual, non-narrative fields) — capped
at 2,000 chars each (path/list-sized, not prose-sized).

**D5 — RBAC: reuse `creative_design` verbatim, no new migration.** Read directly from
`00013-seed-rbac-matrix.ts:132-140` and Design Token Library's own e2e suite/service — the real
seeded grants are:

```
super_admin                VCERAPX  (create, edit, review, approve, publish/unpublish, export — not submit)
owner_growth_approver       VERAPX  (edit, review, approve, publish, export — not create, not submit)
marketing_editor                VR  (view, review only)
designer_creative_reviewer   VCERAS  (create, edit, review, approve, SUBMIT — the only role holding submit)
developer                        V  (view only)
qa_security_reviewer            VR  (view, review only)
read_only                        V  (view only)
```

Design Token Library's own `changeApprovalStatus()` uses only `submit`/`review`/`approve`
(mapped from `TRANSITIONS`) — no `publish`/`unpublish` mechanism exists there despite the group
seeding `P`/`X` grants (confirmed by reading `design-tokens.service.ts`/`.controller.ts` in
full — no `publish`/`unpublish` route, method, or DTO field anywhere). Component Library follows
that exact same precedent: **no publish/unpublish mechanism is built here either** — the `P`/`X`
grants stay unwired for this module too, consistent with its immediate sibling, not a Content
Template Library-style publish state (that module's own `publish`/`unpublish` mechanism came from
a design fork explicitly confirmed for THAT module, not a Component Library requirement — nothing
in this module's own spec/roadmap names a publish concept distinct from `approved`).

### Other fields — judgment calls

- **`category`**: plain text, not an enum. The spec's own list is 40+ items long and explicitly
  described as non-exhaustive ("Components include: ..."), unlike Design Token Library's own
  ~15-value `group` taxonomy (which the spec gives as a finite, collapsible set). Forcing an enum
  here would either need constant migrations as new component types are cataloged, or an
  unwieldy 40+-member ENUM up front — free text (capped at 100 chars, matching
  `DesignTokenGroup`'s peers' typical string caps) is the honest reading.
- **`figmaReference`**: plain nullable URL, validated via the shared `safeHttpUrlSchema`
  (`@webdesk/validation`) — the same helper Brand Library's `fileReference` and Design Reference
  Library's `screenshotUrl`/`sourceUrl` already use, closing the stored-XSS class this project has
  hit once already (Projects' `environment.url`) rather than reinventing URL validation.
- **`responsiveBehavior`, `browserSupport`, `accessibility`**: plain nullable text — factual/
  checklist-shaped fields (matching D4's own reasoning), capped at 2,000 chars each.
- **`schema`, `analytics`, `tests`**: plain nullable text, no structured sub-shape — out of scope
  for a first backend pass, matching every sibling module's own "don't invent structure the spec
  doesn't name" discipline. Capped at 2,000 chars each.
- **`replacementId`**: a nullable self-referential `recordId` (the stable logical-record identity,
  not a specific version row's `id`) into `components` itself — "this whole logical record is
  replaced by that whole logical record," matching how `tokenIds` resolves against Design Token
  Library's own `recordId`. Existence-validated in-module against `findCurrentByRecordId()` (no
  cross-module call needed — `components` validates against itself). Not enforced to be
  immutable across a record's own version chain (unlike `category`) — which version superseded a
  component can legitimately change as the replacement itself gets revised, so this field is
  editable through the normal `update()` path.
- **`lastReview`**: NOT a distinct stored field — redundant with `updatedAt` (every mutation,
  including a status transition, already stamps this) and the audit trail's own per-transition
  timestamps, exactly Design Token Library's own precedent (it has no distinct field for this
  either). Not built here.
- **`changelog`**: NOT a distinct stored field in this pass — the real version-history mechanism
  (every version is a permanently-readable row via `GET .../:recordId/versions`) already is the
  changelog, matching how Design Token Library's own migration doc comment frames "preserve
  versions" as satisfying this exact roadmap language. A separate free-text changelog field/UI
  would duplicate that without adding real information; out of scope for a backend-only pass.

### Explicitly out of scope

- No `dashboard-web` UI — backend-only pass, matching every prior module's own backend-first
  precedent.
- No publish/unpublish mechanism (D5).
- No structured `states`/`schema`/`analytics`/`tests` sub-shape (D3, other-fields notes).
- No `changelog`/`lastReview` distinct fields (other-fields notes).

---

## As-built

Built directly (no delegation to a background subagent, per this project's own standing caution
about a prior incident of exactly that). Branch `module-component-library`, off `main` at
`6149af8`.

### What was built

- **Migrations `00078`/`00079`** (`packages/database/src/migrations/`): `00078-create-component-library.ts`
  creates `components` (the single-table version-history schema per D1) plus its three indexes
  (`components_public_id_current_unique` — partial, `WHERE is_current = true`;
  `components_record_version_unique`; `components_record_current_idx`) and a `pg_trgm` GIN index
  on `name`. `00079-mark-component-library-in-development.ts` flips
  `module_registry.implementation_status` for `component_library` to `in_development`.
- **`packages/database/src/component-library/`**: `entities.ts` (`ComponentEntity`,
  `ComponentApprovalStatus`), `models.ts` (`getComponentLibraryModels()`), `entity-mapping.ts`
  (per-module `toEntityWithIsoDates()`), `component.repository.ts` (`ComponentRepository` —
  `create`/`createNewVersion`/`findCurrentByRecordId`/`findCurrentByPublicId`/`listVersions`/
  `list`/`findByIds`/`updateInPlace`/`updateApprovalStatus`/`supersedeOtherApprovedVersion`),
  `index.ts`. Wired into both `packages/database/src/index.ts` AND `index.cjs.ts` (the
  separately-maintained CJS barrel Vercel's bundler actually uses in production).
- **`DesignTokenRepository.findByIds()`** added to the existing
  `packages/database/src/design-token-library/design-token.repository.ts` — a new method, not a
  new file, needed to back the cross-module `tokenIds` existence check (D2). Existing exports
  unchanged.
- **`DesignTokensService.existingTokenIds()`** added to the existing
  `apps/dashboard-api/src/design-token-library/design-tokens.service.ts` — mirrors
  `ServicesService.existingServiceIds()`'s already-reviewed narrow-delegating-method pattern,
  built in from the start (not reactively, unlike that pattern's own original introduction) so
  `DesignTokenLibraryModule` never needs to export the write-capable `DESIGN_TOKEN_REPOSITORY`
  token across the module boundary.
- **`apps/dashboard-api/src/component-library/`**: `component-library.constants.ts`
  (`COMPONENT_REPOSITORY`, `MODULE_KEY = "creative_design"`), `database.providers.ts`,
  `component-library.dto.ts` (Zod schemas — `tokenIds`/`replacementRecordId` are
  `z.string().uuid()`-typed, unlike Persona Library's own looser `idListField`, so no
  malformed-UUID filtering is needed service-side), `components.service.ts` (`ComponentsService` —
  `create`/`findCurrent`/`listVersions`/`list`/`update`/`changeApprovalStatus`, plus
  `assertTokenIdsExist()`/`assertReplacementExists()`), `components.controller.ts` (7 routes:
  `GET /`, `GET /:recordId`, `GET /:recordId/versions`, `POST /`, `POST /:recordId/update`,
  `POST /:recordId/status`), `component-library.module.ts` (imports `AuthModule`, `AuthzModule`,
  `AuditModule`, `DesignTokenLibraryModule`). Every `@RequirePermission` decorator is
  method-level, never class-level (the exact bug class Service Library's/Page Workspace's own
  code reviews have each caught once already for a fresh module).
- **`apps/dashboard-api/src/app.module.ts`**: `ComponentLibraryModule` registered
  (alphabetically, between `BusinessKnowledgeModule` and `ContentTemplateLibraryModule`).
- **No `packages/shared-types` or `dashboard-web` changes** — backend-only pass, per scope.

### Deviations from the plan

- **D1 (table shape)**: the prompt itself already anticipated the single-table-vs-two-table
  ambiguity and asked for a judgment call; confirmed the identical doc-naming pattern exists for
  Design Token Library too (`design_tokens`/`design_token_versions` named in the doc, built as one
  table) and followed that established precedent rather than the doc's literal two-table split —
  see the Scope section above.
- **`tokenIds`/`replacementRecordId` as `z.string().uuid()`, not a looser string field**: a
  deliberate improvement over Persona Library's own `relatedServiceIds` precedent (which uses
  `z.string().min(1).max(128)`, needing a service-side `UUID_PATTERN` filter before querying).
  Since both of Component Library's own relationship fields are genuinely UUID-shaped by
  construction (a token's `recordId`, a component's own `recordId`), validating the shape at the
  DTO boundary is strictly better — a malformed value gets a clean 400 from Zod before the service
  ever runs, rather than being silently filtered out of the existence check. Documented explicitly
  in both the DTO file and the service's own doc comment so a future reviewer doesn't mistake the
  absence of a `UUID_PATTERN` guard for a gap.
- **No other deviations** — the RBAC action mapping (submit/review/approve only, no publish/
  unpublish wiring, per D5), the TRANSITIONS table, the atomic CAS/supersede mechanism, and the
  controller/module shape all mirror Design Token Library file-for-file as planned.

### RBAC action mapping found and used (`00013-seed-rbac-matrix.ts:132-140`, `creative_design`)

```
super_admin                VCERAPX  (create, edit, review, approve, publish/unpublish, export — not submit)
owner_growth_approver       VERAPX  (edit, review, approve, publish, export — not create, not submit)
marketing_editor                VR  (view, review only)
designer_creative_reviewer   VCERAS  (create, edit, review, approve, SUBMIT — the only role holding submit)
developer                        V  (view only)
qa_security_reviewer            VR  (view, review only)
read_only                        V  (view only)
```

Confirmed by direct code read: Design Token Library's own `changeApprovalStatus()`/
`design-tokens.controller.ts` use only `submit`/`review`/`approve` (derived from its
`TRANSITIONS` table) — no `publish`/`unpublish` route, DTO field, or service method exists there
despite the group seeding `P`/`X` grants. Component Library follows that exact same precedent
(D5) — confirmed this is a real, deliberate established pattern, not an oversight, since Content
Template Library's own publish/unpublish mechanism came from an explicit design fork specific to
that module, not a blanket rule for every `creative_design`-group module.

### Validation — every command run directly, results independently confirmed (not just claimed)

All runs used a genuinely disposable local PostgreSQL 17 instance
(`initdb`/`pg_ctl`, trust auth, port 5544 — a separate, throwaway data directory in the session's
own scratchpad, never the machine's existing installed Postgres service, never
staging/production) — `packages/database/.env.local` (gitignored) points at it.

- **`packages/database` unit tests**: 28/28 passing (unaffected — no existing test touched).
- **`packages/database` integration tests** (real disposable database): **519/519 passing**
  overall, including 26 new tests in the new
  `test/module-component-library.integration.test.ts` and 2 new tests in the existing
  `test/module-design-token-library.integration.test.ts` (for the new `findByIds()` method).
- **`apps/dashboard-api` unit tests**: **1191/1191 passing** overall, including 47 new tests in
  `src/component-library/components.service.spec.ts`; the existing
  `src/design-token-library/design-tokens.service.spec.ts` (44 tests, unaffected) re-run and
  confirmed still green after adding `existingTokenIds()`.
- **`apps/dashboard-api` e2e tests** (real disposable database + real seeded RBAC): 27/27 passing
  in the new `test/component-library.e2e-spec.ts` — run twice against two independent fresh
  databases to rule out any shared-state flakiness, both clean. Includes the full 3-tier
  submit/review/approve RBAC matrix, the real cross-module `tokenIds` existence check (both
  create and update paths), the in-module `replacementRecordId` existence check, the full
  create→approve→edit→new-version→approve→supersede round trip over real HTTP, and the terminal-
  state/malformed-id/no-Origin-header guard tests. The existing
  `test/design-token-library.e2e-spec.ts` (22 tests, unaffected by the new `findByIds()` addition)
  was independently re-run and confirmed still green. **The full `apps/dashboard-api`
  `test:integration` suite (all 28 e2e-spec files) was also run in the background to confirm no
  cross-module regression** — see the final tally below.
- **Migration round-trip**: confirmed twice — implicitly, via every integration/e2e test file's
  own `beforeAll`/`afterAll` (`migrator.up()` / `migrator.down({ to: 0 })`) cycling all 79
  migrations cleanly on every run; and explicitly, via a dedicated `migrate` → `migrate:status`
  (79 executed, 0 pending) → CLI `down` (reverts `00079`) → `migrate` (re-applies `00079`) →
  `migrate:status` (79 executed, 0 pending) check against a fourth disposable database.
- **`pnpm validate:module-registry`**: passing — 43 modules, 21 permission groups, all references
  resolve (component_library's own registry row, seeded since migration `00035`, was
  untouched — only its `implementation_status` changed).
- **`pnpm audit --audit-level=high`**: 0 vulnerabilities.
- **Typecheck**: clean on both `packages/database` and `apps/dashboard-api`
  (`tsc --noEmit`), re-confirmed after the prettier auto-format pass below.
- **Lint**: clean on both packages (`eslint --max-warnings=0`), re-confirmed after the prettier
  auto-format pass below.
- **`prettier --check`**: initially flagged 8 touched/edited files (auto-formatting drift on
  files edited by hand, not a content bug) — fixed with `prettier --write`, then re-verified
  clean; typecheck, lint, and the affected unit/e2e test files were all independently re-run
  after the reformat and confirmed still green.

- **Full `apps/dashboard-api` `test:integration` suite** (all 28 e2e-spec files, real disposable
  database, sequential per this project's own `fileParallelism: false` convention):
  **517/517 passing, 0 failures** — confirming no cross-module regression from either the new
  `ComponentLibraryModule` registration in `app.module.ts` or the `DesignTokensService`/
  `DesignTokenRepository` additions.
