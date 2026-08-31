# Motion and Interaction Library — implementation record

## Scope

Module #? on the Recommended Module Roadmap (no explicit wave number — `dependencies: null` in
the seeded module registry, so nothing blocks building it now). It is itself a listed dependency
of Wave 4's `design_review_center`, alongside `component_library`, `design_token_library`,
`section_and_pattern_library`, `page_template_library`, and `wireframe_library` — of that group,
only `wireframe_library` remains unbuilt after this module lands.

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
file read directly (migration `00084`, RBAC decorator placement, both `packages/database` barrel
exports, `app.module.ts` wiring), and every test suite re-run against a fresh local disposable
PostgreSQL 17 database, not trusted from the agent's own report.

Migration `00084-create-motion-and-interaction-library.ts` creates `motion_interaction_records`
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
`00085` marks the module `in_development` in the registry. `apps/dashboard-api/src/
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
up → down → up round-trip (85 migrations, table schema confirmed directly via `psql \d`),
1340/1340 `dashboard-api` unit tests (41 new, in `motion-interactions.service.spec.ts`), 596/596
`packages/database` integration tests (26 new), 599/599 `dashboard-api` e2e/integration tests (27
new — covering the full `creative_design` RBAC submit/review/approve matrix, the
`relatedComponentIds` existence-validation success/failure cases, and the version-history/
supersede-on-approval behavior), `validate:module-registry` (43 modules, 21 permission groups,
unaffected), typecheck/lint (`--max-warnings=0`)/prettier all clean across every touched file,
`pnpm audit` 0 vulnerabilities.
