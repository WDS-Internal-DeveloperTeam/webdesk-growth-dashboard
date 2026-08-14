# Phase 1F — Module Registry Extension (as-built)

**Status:** Records what was actually built for brief §5–§7, §12–§13, §26–§27 — the canonical
43-module registry, extended with the full field set the application shell reads.

## 1. Two distinct concepts — not the same table (brief §3)

- **`modules`** (21 rows, migration `00010`/seeded `00013`) — the **permission group** the real
  RBAC grant matrix is scoped to (`06_Roles_and_Permissions.md §3`). Pre-existing, Phase 1D.
- **`module_registry`** (43 rows, migration `00014`/seeded `00015`, **extended** here) — the real
  product feature modules from `02_Version_1_Module_Inclusion_Matrix.md`. Each row's
  `permission_group_id` maps it to exactly one of the 21 permission groups; several modules
  legitimately share one group.

Phase 1D-expanded already created `module_registry` with a minimal field set (key, name,
permission group). Phase 1F extends the same table — no new table, no duplicate registry — with
everything the application shell's navigation actually needs to render.

## 2. Fields added (migration `00034-extend-module-registry.ts`)

`display_name`, `description`, `navigation_group`, `navigation_order`, `route` (nullable at first,
made `NOT NULL` + unique once real distinct values existed — see §4), `icon_reference`,
`v1_inclusion_status` (enum: `included`/`deferred`/`future`), `implementation_status` (enum:
`not_started`/`foundation_only`/`in_development`/`ready_for_review`/`approved`/`available`/
`deferred`/`blocked`/`deprecated`), `view_permission_action`, `action_permissions` (JSONB),
`feature_status`, `documentation_reference`, `help_document_reference`, `owner`, `dependencies`
(JSONB), `confidentiality_level` (TEXT — widened from an initial `STRING(64)` that couldn't hold
real explanatory text like "advisory until Search Strategy + Growth Director review + human
approval", 74 characters), `badge_support`, `visibility_rules` (JSONB), `deprecation_reference`,
`registry_version`, `last_reviewed_at`.

## 3. Data populated (migration `00035-populate-module-registry-fields.ts`)

All 43 existing rows (matched by their already-seeded `key` — no new rows created), sourced from
`01_Dashboard_Master_Specification.md`, `02_Version_1_Module_Inclusion_Matrix.md`, and
`03_Detailed_Module_Specifications.md`. Every honest-default decision is documented in the
migration's own doc comment; the load-bearing ones:

- **`implementation_status: "not_started"` for all 43`** — no module's real business functionality
  exists yet; Phase 1F builds shell/registry only. Never claimed otherwise.
- **`v1_inclusion_status: "included"` for all 43`** — none of the 43 approved modules are marked
  Deferred/Future in the Module Inclusion Matrix.
- **`view_permission_action: "view"` uniformly** — see `phase-1f-navigation-authorization.md` §4
  for the real bug this corrected (an initial per-module `${key}_view` string that matched nothing
  in the real seeded RBAC grants).
- **`owner: "TBD"`, `help_document_reference: null`** — no per-module steward or help content is
  documented anywhere in the approved specs (confirmed by direct search); shown honestly as
  unavailable rather than invented.
- **`navigation_group`/`navigation_order`** — this implementer's own reasoned assignment into the
  10 approved wireframe nav labels (`07_Low_Fidelity_Wireframes.md §1`). No source document states
  a per-module nav-group assignment; flagged as such in the migration's own comment, same
  discipline as the original 43→21 permission-group mapping (migration `00015`)'s doc comment.
- **`dependencies`** — this implementer's own reasoned cross-reference of each module's spec
  section against every other module it mentions. See
  `docs/phase-plans/module-implementation-roadmap.md` for the full computed build-order analysis
  derived from this field, including three genuine dependency cycles the data contains.

## 4. Schema-integrity fix during this work

`route` was initially added as `NOT NULL` with a shared default across all 43 rows in the same
migration that also tried to add a unique index — impossible, since every row would share the
default value. Fixed by making `route` nullable in `00034` (no unique index yet), then in `00035`,
after real distinct route values were populated, running `ALTER TABLE ... ALTER COLUMN route SET
NOT NULL` and creating the unique index — sequenced correctly rather than reordered after the fact.

## 5. Validation (brief §26/§27)

- **`packages/database/src/authz/module-registry.expected-keys.ts`** — a versioned,
  git-reviewable list of the 43 approved keys (`EXPECTED_MODULE_REGISTRY_KEYS`). Any drift between
  this list and the live table is itself a validation failure.
- **`packages/database/src/authz/module-registry-validation.ts`** — pure `validateModuleRegistry()`
  function (no database dependency, unit-testable): row count matches the expected-keys list
  exactly; every expected key exists; no unauthorized key exists; no duplicate key or route; every
  route starts with `/`; every `navigation_group` is one of the 10 approved groups
  (`@webdesk/shared-types`'s `APPROVED_NAVIGATION_GROUPS`); every `v1_inclusion_status`/
  `implementation_status` is a real enum value; `view_permission_action` is non-empty;
  `documentation_reference` both exists and resolves to a real file on disk (checked via an
  injectable predicate so the unit tests never touch the real filesystem); every
  `permission_group_id` resolves to a real row in the 21-row `modules` table; exactly 21 permission
  groups exist.
- **`packages/database/src/validate-module-registry.ts`** — the CLI entrypoint that fetches the
  live rows and calls the pure function above, used both locally and in CI.
- **`.github/workflows/ci.yml`**'s `database-migration-test` job — after the migration up/down
  round trip, re-applies all migrations fresh (the round-trip's own "down" step only reverts the
  single last migration, which would leave the registry without its full real data) and runs
  `pnpm --filter @webdesk/database validate:module-registry`.
- **9 real unit tests** (`module-registry-validation.test.ts`) covering every failure mode above
  with a deliberately-broken fixture.

## 6. What was deliberately not built

- No admin UI for editing registry rows — the registry is migration-managed, matching every other
  seeded-data table in this project (roles, permission groups, retention categories, etc.).
- No enforcement that `dependencies` values are themselves valid module keys — the roadmap
  document (§239) was built from the raw data as-is; a future validation pass could add this check
  if the registry grows and drift becomes a real risk, but it wasn't needed for this phase's scope.
