# Motion and Interaction Library — implementation record

## Scope

Module #? on the Recommended Module Roadmap. At the time this build started, the seeded module
registry had `dependencies: null` for this module (Wave 1). A code-review finding (see "As-built"
below) surfaced that the real build introduces a hard dependency on Component Library, and a
follow-up migration corrected the registry — `motion_and_interaction_library` now sits in Wave 2,
depending only on `component_library` (already live), so nothing blocked building it. It is
itself a listed dependency of Wave 4's `design_review_center`, alongside `component_library`,
`design_token_library`, `section_and_pattern_library`, `page_template_library`, and
`wireframe_library` — of that group, only `wireframe_library` remains unbuilt after this module
lands.

Built directly on the explicit "start Motion & Interaction Library" instruction.

The canonical spec (`webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md
§18`) gives no field list — only a bare taxonomy of ~26 interaction categories (page transitions,
focus/active/selected/disabled states, form feedback, menus, modals/drawers, tooltips, sticky
behavior, content reveal, loaders, progress, success/error, notifications, media controls,
filters/search, pagination, copy/share, anchors, parallax, cursor, dismissal, screen-reader
announcements, timing, interruption, analytics, no-JS fallback). The same spec-gap situation
Section and Pattern Library (§15) and Design Token Library (§13, partially) both hit.

Two design forks confirmed directly with the project owner first (`AskUserQuestion`):

- **D1 — field set.** Modeled on the §18 taxonomy: `category` (a closed enum covering the ~26
  taxonomy items), `name`, `publicId`, `description` (rich text — what the interaction is/does),
  `triggerAndBehavior` (rich text — what triggers it and how it behaves), `timingAndEasing`
  (plain text — duration/easing curve, not prose), `implementationSpec` (plain text — a CSS/JS
  code snippet, no rich-text sanitization, matching Section and Pattern Library's
  `htmlStructure`/`scssReference` precedent for real code fields), `accessibilityNotes` (rich
  text — screen-reader/keyboard/reduced-motion considerations), `fallbackBehavior` (plain text —
  no-JS behavior), `designReference` (a `safeHttpUrlSchema`-validated URL), `relatedComponentIds`
  (see D2), plus the standard approval workflow and real multi-row version history every sibling
  design-system module already uses.
- **D2 — relationship validation.** `relatedComponentIds` is a REAL, existence-validated
  relationship into Component Library (`ComponentsService.existingComponentIds()`), not an
  unvalidated plain array — a genuine improvement over the Design Token/Section-and-Pattern
  Library precedent, since `component_library` already exists (unlike when those two were built).
  Mirrors Page Template Library's own `supportedComponentIds` wiring exactly (a narrow read-only
  delegating method exported from `ComponentLibraryModule`, not the write-capable repository
  token directly).

Structural template: mirrors Section and Pattern Library's file layout (single table, real
version history, no `project_id` scoping, no confidentiality mechanism — the registry seeds
`confidentialityLevel: null` — no publish/unpublish action, since nothing in §18 names one) plus
Page Template Library's cross-module relationship pattern for the one real relationship field.
RBAC: reuses the `creative_design` permission group verbatim (already seeded for exactly this
module) — no new RBAC migration.

Backend-only pass — `dashboard-web` UI is a separate, not-yet-requested next step, matching every
prior module's own backend-first precedent.

## As-built

Built by a background agent with a fully-specified prompt mirroring Section and Pattern Library
(structural template) and Page Template Library (the one real cross-module relationship
pattern), then independently re-verified in full by the orchestrating session — every high-risk
file read directly (migration `00086`, RBAC decorator placement, both `packages/database` barrel
exports, `app.module.ts` wiring), and every test suite re-run against a fresh local disposable
PostgreSQL 17 database, not trusted from the agent's own report.

Migration `00086-create-motion-and-interaction-library.ts` creates `motion_interaction_records`
(single table, real multi-row version history — `record_id`/`public_id`/`version_number`/
`is_current`, partial unique index on `public_id` WHERE `is_current`, unique
`(record_id, version_number)`, and the same three follow-up indexes Section and Pattern
Library's/Page Template Library's own migrations added — `(record_id, is_current)`, a partial
`(updated_at, id)` WHERE `is_current` for `list()`'s real query shape, and
`(record_id, approval_status)` for `supersedeOtherApprovedVersion()`), plus a `pg_trgm` GIN index
on `name`. `category` is a 26-value immutable enum transcribed from §18's own taxonomy.
`description`/`triggerAndBehavior`/`accessibilityNotes` are rich-text-sanitized;
`timingAndEasing`/`implementationSpec`/`fallbackBehavior` stay plain (code/spec values, not
prose — matching Section and Pattern Library's `scssReference`/`htmlStructure` treatment).
`relatedComponentIds` is a real, existence-validated relationship into Component Library via
`ComponentsService.existingComponentIds()` (D2), imported into a new
`MotionAndInteractionLibraryModule` alongside `AuthModule`/`AuthzModule`/`AuditModule`. Migration
`00087` marks the module `in_development` in the registry. `apps/dashboard-api/src/
motion-and-interaction-library/` has the standard controller (routes: `POST /`, `GET /`,
`GET /:recordId`, `GET /:recordId/versions`, `POST /:recordId/update`, `POST /:recordId/status`,
every `@RequirePermission` decorator method-level, never class-level), service (the standard
8-value `TRANSITIONS` table with no `approved -> superseded` edge — supersede is automatic on a
new version's own approval — and the atomic CAS discipline on both in-place updates and status
transitions, identical to every sibling design-system module), and DTOs. Both
`packages/database` barrel files (`index.ts`/`index.cjs.ts`) updated. No new npm dependency, no
new RBAC migration (reuses `creative_design` verbatim, already seeded for this exact module).
Backend-only pass — `dashboard-web` UI is a separate, not-yet-requested next step.

**Validation, independently re-run by the orchestrating session against a fresh local disposable
PostgreSQL 17 database** (not just trusted from the build agent's own report): a real migration
up → down → up round-trip (88 migrations, table schema confirmed directly via `psql \d`),
1340/1340 `dashboard-api` unit tests (41 new, in `motion-interactions.service.spec.ts`), 596/596
`packages/database` integration tests (26 new), 599/599 `dashboard-api` e2e/integration tests (27
new — covering the full `creative_design` RBAC submit/review/approve matrix, the
`relatedComponentIds` existence-validation success/failure cases, and the version-history/
supersede-on-approval behavior), `validate:module-registry` (43 modules, 21 permission groups,
unaffected), typecheck/lint (`--max-warnings=0`)/prettier all clean across every touched file,
`pnpm audit` 0 vulnerabilities.

**Independent code review then ran** (this project's own `code-review` skill, high effort,
8-angle finder pass via parallel subagents, 1-vote self-verification) — every angle came back
clean except two candidates that survived dedup and verification: **1 CONFIRMED, 1 PLAUSIBLE**.
The CONFIRMED finding was fixed: the seeded `module_registry.dependencies` for
`motion_and_interaction_library` was `null` (migration `00035`), inconsistent with the real, hard
runtime dependency this build introduces on Component Library
(`ComponentsService.existingComponentIds()`, called on every `create()`/`update()`) — the
identical class of coupling `page_template_library`'s own seeded row already correctly records.
Left unfixed, this would have silently diverged from `docs/phase-plans/module-implementation-
roadmap.md`, which computes its build-order "waves" by mechanically transcribing this exact
field. Fixed with a new, additive migration
(`00088-add-motion-and-interaction-library-dependency.ts` — not an edit to `00035`, which had
already run against production before this branch existed) and the roadmap doc updated to move
this module from Wave 1 to Wave 2. The 1 PLAUSIBLE finding — `updateMotionInteractionRecordSchema`
hand-retyping its 8 shared optional fields from `createMotionInteractionRecordSchema` instead of
deriving via `.omit()`/`.partial()` — was left as accepted, tracked debt: the derived pattern
(already used by Content Template Library, Brand Library) is real and safer against drift, but
6 of 8 other sibling modules checked (including ones built after that fix landed) still
hand-duplicate the same way this module does — a real but inconsistently-applied convention in
this codebase, not a rule this module uniquely broke. A third candidate (an "unused speculative
`findByIds()`/`existingRecordIds()`" claim, surfacing 3 separate finder angles) was REFUTED on
verification — unlike Page Template Library's own removed dead method, this one mirrors an
established, already-realized convention (Section and Pattern Library's identical
`existingRecordIds()`, consumed by Page Template Library once it needed it), ships with an
explicit doc-comment rationale, and has real, intentional test coverage, not orphaned artifacts.

Re-validated after the fix: a fresh disposable-database migration round-trip (88 migrations),
`motion_interaction_records.dependencies`-consuming code unaffected, `validate:module-registry`
still 43/21 clean, typecheck/lint/prettier clean.

**Migration numbers renumbered from `00084`/`00085`/`00086` to `00086`/`00087`/`00088`** after
merging `main` — Wireframe Library (module #16) had merged to `main` as `00084`/`00085` while
this branch was in progress. Every internal reference (doc comments, this file, the roadmap doc)
was updated to match, and the renumbering was independently re-verified against a real database
(a full 88-migration up round-trip, `dependencies` value confirmed via `psql`).
