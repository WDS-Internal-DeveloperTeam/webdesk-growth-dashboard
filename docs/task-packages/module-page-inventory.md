# Task Package — Page Inventory Module (Backend)

Module #7 on `canonical-inputs/Recommended_Module_Roadmap.md` (Wave 2), the 7th real business
module after Projects, Business Knowledge Center, Service Library, Persona Library, Proof and
Claims Library, and Website Strategy Center. Built directly on the explicit "Start the Page
Inventory module" instruction.

## Sources

- `webdesk-dashboard-documentation-v1/03_Detailed_Module_Specifications.md` §5 — the canonical
  field list, filters, and acceptance rule.
- `webdesk-dashboard-documentation-v1/04_Data_Model_and_Ownership.md` — the broader "Pages and
  artifacts" entity cluster and its stated unique constraints.
- `webdesk-dashboard-documentation-v1/06_Roles_and_Permissions.md` §3 and
  `packages/database/src/migrations/00013-seed-rbac-matrix.ts` — the `page_inventory` RBAC group
  (both sources agree exactly: `super_admin: VCERAMX`, `owner_growth_approver: VCERAX`,
  `marketing_editor: VCES`, `designer_creative_reviewer: V`, `developer: VCE`,
  `qa_security_reviewer: VR`, `read_only: V`).
- `webdesk-dashboard-documentation-v1/07_Low_Fidelity_Wireframes.md` §2 — the only approved
  wireframe.
- `packages/database/src/migrations/00035-populate-module-registry-fields.ts` — the seeded
  registry entry (`route: "/page-inventory"`, `iconReference: "layout-list"`,
  `navigationGroup: "pages"`, `dependencies: null`, `confidentialityLevel: null`).
- `canonical-inputs/Recommended_Module_Roadmap.md` row 7 — the classification scheme
  (Keep/Optimize/Restructure/Redesign/Rebuild/Consolidate), absent from every other source above.

## Genuine forks confirmed directly with the user (`AskUserQuestion`)

**D1 — Table scope: `pages` + `page_urls` only, not the full 7-table "Pages and artifacts"
cluster.** The data-model doc's cluster (`pages`, `page_urls`, `page_artifacts`,
`page_artifact_versions`, `page_relationships`, `page_component_usage`, `page_deployments`) is
broader than this module's own spec section. The module registry shows `page_workspace` (module
#6) as its own separate module that itself *depends on* `page_inventory` — the artifact/version/
component/deployment tracking is Page Workspace's own, later, not-yet-authorized scope, not
duplicated here.

**D2 — `pages` IS project-scoped (`project_id`), unlike every prior content-library module.**
Every module built so far (Website Strategy Center, Business Knowledge Center, Service/Persona/
Proof-and-Claims Library) is organization-wide. Page Inventory is the first genuine exception: a
website's pages naturally belong to one specific client project, and the spec's own "roadmap
phase" field only makes sense as a real relationship once scoped to a project (see D6). Confirmed
directly with the user rather than assumed, since it's a first-of-its-kind deviation from every
established sibling module.

**D3 — "Scan Website"/"Import" (named in the wireframe's own action bar) are deferred, not
built.** No WordPress integration adapter exists yet in `packages/integrations`, and only a
staging-only WordPress Application Password is configured (`CLAUDE.md`'s own standing Open client
blocker). This pass builds manual CRUD only (`+ New Page`, list/detail/edit) — Scan/Import remain
their own, separate, not-yet-authorized follow-up once a real WordPress adapter exists.

## Design decisions (not independently forked — applying established precedent)

- **D4 — WordPress page/post ID**: plain nullable fields (`wordpressPageId`/`wordpressPostId`,
  string), external references only — no real FK, no validation against a live WordPress site
  (matches D3).
- **D5 — Template**: plain nullable string field. `page_templates`/Page Template Library (module
  #16) isn't built yet — same "store unvalidated, migrate to a real FK once the target module
  exists" pattern already used repeatedly (Service Library's `icpIds`, Persona Library's original
  `relatedServiceIds` before Service Library existed).
- **D6 — Roadmap phase**: a real, existence-validated FK to `roadmap_items.id` (nullable) —
  meaningful now that `pages` is project-scoped (D2), following the same
  `assertServiceIdsExist()`-style existence-check pattern Persona Library/Proof and Claims Library
  both already established for their own cross-module FK fields.
- **D7 — Target keyword**: plain nullable string field. Keyword & Entity Library (module #8)
  isn't built yet — same deferred-FK pattern as D5.
- **D8 — Workflow stage**: reuses the shared 8-value generic artifact-lifecycle vocabulary
  (`draft`/`submitted`/`under_review`/`approved`/`revision_requested`/`rejected`/`superseded`/
  `archived`) verbatim from Service/Persona/Proof-and-Claims/Website-Strategy-Center's own
  identical `TRANSITIONS` table — a 5th occurrence of this identical shape, deliberately not
  extracted into a shared helper, matching every prior module's own disposition on this exact
  point (already-accepted, out-of-scope debt).
- **D9 — Classification (Keep/Optimize/Restructure/Redesign/Rebuild/Consolidate)**: named only in
  the roadmap, absent from the spec/data-model/wireframe/registry description. Per the roadmap
  row's own instruction ("Live/repo evidence must outrank roadmap claims") this is NOT treated as
  a spec-sourced required field — but since the roadmap's own per-module special instructions are
  applied once a module build actually starts (established precedent — e.g. Service Library's own
  `icpIds`/`relatedPageIds`/`relatedCaseStudyIds` scope came from the identical roadmap
  mechanism), it's added as a nullable enum (`keep`/`optimize`/`restructure`/`redesign`/`rebuild`/
  `consolidate`) with no governance/workflow attached — purely descriptive, roadmap-sourced,
  flagged in code as such, not fabricated beyond what the roadmap itself states.
- **D10 — Acceptance rule ("each URL has one canonical active page record unless an approved
  redirect or archive relationship exists")** maps to a `page_urls` child table (one page can have
  multiple URLs — locale variants, legacy redirects), each row carrying `isCanonical`, with a
  partial unique index `UNIQUE(project_id, url) WHERE is_canonical = true` — a real DB-layer
  invariant, not just application-code discipline, matching this project's own standing pattern
  (Projects' `active_phase_id`, Website Strategy Center's `is_current`).
- **No confidentiality field** — module registry's own seeded `confidentialityLevel` for
  `page_inventory` is `null`, matching Persona Library's/Proof and Claims Library's own entries.
- **No real multi-row version history** — unlike Website Strategy Center, nothing in this
  module's spec names "compare versions"/"supersede" actions; a single mutable row per page,
  matching every module except Website Strategy Center.

## Scope

`pages` + `page_urls` tables, RBAC-gated CRUD + workflow-stage transitions, existence-validated
`roadmapPhaseId`. No `dashboard-web` UI in this pass (backend-first, matching every prior
module's own precedent) — a separate, not-yet-requested next step.
