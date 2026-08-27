# Design Token Library — module backend

## Scope

Module #14 on the Recommended Module Roadmap (`canonical-inputs/Recommended_Module_Roadmap.md:50`,
Wave 4: "Build canonical **WordPress website** design tokens. Keep completely isolated from
dashboard UI tokens. Version changes."). Distinct module from the already-built Design Reference
Library — module registry key `design_token_library`, `navigationGroup: "libraries"`,
`navigationOrder: 9`, `route: "/design-token-library"`, `iconReference: "swatch-book"`,
`dependencies: null` (no dependencies of its own; `component_library` and `design_review_center`
depend on it later), `confidentialityLevel: null`. RBAC: `permissionGroupKey: "creative_design"` —
the same group already used by Brand Library and Design Reference Library, reused verbatim, no new
RBAC migration.

This module catalogs literal design-token values (colors, spacing, typography, etc.) for the
**WordPress website** deliverable — explicitly isolated from this dashboard's own `packages/ui`
design tokens, which are a separate, unrelated system.

### Source

- `webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md §13` (lines 94-98):
  - Token groups: colors, semantic statuses, approved combinations, light/dark themes, font
    family/size/weight/line-height/letter-spacing, spacing, grids, gutters, margins, containers,
    breakpoints, borders, radii, shadows, opacity, z-index, icon sizes/strokes, image/video
    ratios, component sizes, motion, focus, form, interactive states.
  - Fields: token ID, name, value, unit, group, semantic purpose, responsive variation, theme
    variation, status, version, approval, usage references.
- `04_Data_Model_and_Ownership.md:147-148` names two real tables: `design_tokens` and
  `design_token_versions` — a genuine one-to-many version-history relationship.
- RBAC matrix (`00013-seed-rbac-matrix.ts:136-144`) already seeds Submit/Review/Approve actions
  for `creative_design`: `designer_creative_reviewer` submit, `marketing_editor` review,
  `super_admin`/`owner_growth_approver` approve.
- No wireframe, no workflow-state-machine doc entry, no module-specific text in
  `06_Roles_and_Permissions.md` beyond the RBAC matrix row.

### Design decisions confirmed with the user (`AskUserQuestion`, 2026-08-27)

1. **Real multi-row version history**, mirroring Website Strategy Center exactly — every version
   its own row, a stable `recordId` copied forward, `isCurrent` flag, a `publicId` uniqueness
   constraint scoped to `WHERE is_current = true` (a partial unique index, not a bare column
   constraint), approving a new version auto-supersedes whichever other version of the same
   `recordId` currently holds `approved`. Chosen over a simpler single-mutable-row table, since
   the data model doc explicitly names two tables.
2. **Standard `ArtifactApprovalStatus` workflow**, reused verbatim from Website Strategy
   Center/Brand Library/Persona Library/Service Library — same `TRANSITIONS` table shape, same
   atomic compare-and-swap repository pattern, same dynamic per-transition
   `AuthorizationService.assertAllowed()` check inside the service layer (the route itself is
   gated only on `view`). Matches the seeded submit/review/approve RBAC actions exactly.
3. **`usageReferences` stored as a plain unvalidated string array** — no `component_library`/
   `page_workspace` module exists yet to link it to for real, matching the established precedent
   (Persona Library's `relatedServiceIds`, Proof and Claims Library's `relatedPageIds`) for a
   relationship with no real target module yet.

### Explicitly out of scope for this pass

- `dashboard-web` UI — backend only, matching every prior module's own backend-first precedent.
- Any real enforcement or consumption of these tokens by `packages/ui`/`dashboard-web`'s own
  theming — this module is a catalog of WordPress-website tokens, deliberately isolated per the
  roadmap's own instruction.
- Linking `usageReferences` to a real entity — no target module exists yet.

## As-built

Built on branch `module-design-token-library`, off `main` at the Brand Library UI merge commit
(`3e2e7c486c3f839056fbcf67221228c68f5437b1`). File-for-file mirrors Website Strategy Center's own
real-version-history pattern (`packages/database/src/website-strategy-center/*`,
`apps/dashboard-api/src/website-strategy-center/*`) — every version of a record is its own
physical row, `recordId` is the stable logical-record identity, `publicId`/`group` are copied
forward immutably across a record's version chain, uniqueness is a partial index
`WHERE is_current = true`, and "supersede" is an automatic side effect of a new version's own
`-> approved` transition (never a directly requestable transition — the `TRANSITIONS` table has no
`approved -> superseded` edge, matching Website Strategy Center's own deliberate deviation from the
Service/Persona/Proof-and-Claims Library copies).

**Fields**: `group` (a 15-value enum collapsing the spec's own finer-grained token-group taxonomy
— see `packages/database/src/design-token-library/entities.ts`'s own doc comment for exactly which
spec items each value covers), `name`, `value`, `unit` (nullable), `semanticPurpose` (nullable),
`responsiveVariation` (nullable), `themeVariation` (nullable `light`/`dark`/`both`), and
`usageReferences` (a plain, unvalidated `string[]`, design decision 3). The spec's own "status" and
"version" fields are satisfied by the real version-history mechanism itself (`versionNumber`) and
the standard `approvalStatus` workflow — no separate fields were added for them.

**RBAC**: reuses the seeded `creative_design` permission group verbatim — no new RBAC migration.
Its real grant shape is genuinely different from every sibling artifact-workflow module's own
matrix: `designer_creative_reviewer` (`VCERAS`) is the ONLY role holding `submit`, and it also
holds `create`/`edit`/`review`/`approve` — meaning it alone can drive the entire
submit→review→approve loop unassisted, unlike every sibling module where those three actions are
always split across at least two roles. `owner_growth_approver` (`VERAPX`) notably has no `create`
grant for this group (unlike `website_strategy`'s equivalent role, which does). `MODULE_KEY`
(`"creative_design"`) was centralized in `design-token-library.constants.ts` rather than
duplicated as a separate literal in both the service and the controller — a small, deliberate
deviation from this project's own accepted-debt pattern of per-file duplication, since a constants
file already existed here to hold it.

**Validation** (all run directly, not delegated): `packages/database` build/lint clean;
`dashboard-api` typecheck/lint clean; `pnpm exec prettier --check` clean across every touched file
(after one `--write` pass fixing 5 files' minor formatting); 1057/1057 `dashboard-api` unit tests
(42 new, `design-tokens.service.spec.ts`); 465/465 `packages/database` integration tests (23 new,
`module-design-token-library.integration.test.ts`, real disposable PostgreSQL —
`webdesk_phase1b_dev`); 28/28 `packages/database` unit tests (unaffected); 457/457 `dashboard-api`
e2e/integration tests (22 new, `design-token-library.e2e-spec.ts`, real disposable database + real
seeded RBAC, covering create/get/list/versions, the full 6-role RBAC matrix including the
single-role submit→review→approve loop, the fork-on-edit-of-approved path, and the
auto-supersede-on-approve path); a real migration up/down/up round-trip (`pnpm migrate:test` plus
the integration suite's own up→down-to-0 cycle) — 75 migrations, 0 pending after re-applying;
`pnpm validate:module-registry` — 43 modules, 21 permission groups, unaffected; `pnpm audit` — 0
vulnerabilities. Backend-only pass — `dashboard-web` UI is a separate, not-yet-requested next step,
matching every prior module's own backend-first precedent. Not yet code-reviewed, security-
reviewed, gated, pushed, or merged — each remains its own separate, not-yet-requested next step.
