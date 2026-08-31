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

<!-- As-built section appended after the build completes. -->
