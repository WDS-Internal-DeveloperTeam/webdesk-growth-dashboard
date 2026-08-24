# Task Package: Internal Linking Library (module #9)

**Status:** Scoped, authorized to build. Not yet implemented.

## 0. Pre-implementation verification

- **Roadmap position:** module #9 on `canonical-inputs/Recommended_Module_Roadmap.md` (Wave 2),
  recommended-for-reference-only per WDS-014 — this task package is the actual authorization
  record, not the roadmap entry itself.
- **Dependency-computed wave:** `docs/phase-plans/module-implementation-roadmap.md` places
  `internal_linking_library` in Wave 2, part of a genuine cycle with `website_strategy_center`
  ("strategy references planned internal links and internal-link records reference the strategy
  that justified them"). `website_strategy_center` is already live but was built without this
  module (its own module doc comment records that D8 "fabricates no cross-module relationship
  fields" specifically because of this cycle) — so this module has no existing FK/validation hook
  from the Website Strategy Center side to retrofit against. The other named dependency,
  `page_inventory`, is fully live. No blocker.
- **Module registry:** `module_registry.key = "internal_linking_library"`,
  `route = "/internal-linking-library"`, `navigationGroup = "libraries"`,
  `navigationOrder = 20`, `implementationStatus = "not_started"` (migration `00035`, lines
  371–380), `confidentialityLevel = null`.
- **RBAC:** `permissionGroupKey = "keyword_internal_links"` — the exact same group Keyword &
  Entity Library already uses (confirmed, not a coincidence — both modules were seeded to share
  it). Real seeded grants (`00013-seed-rbac-matrix.ts` lines 190–197): Super Admin `VCERAMX`,
  Owner/Growth Approver `VCERAX`, Marketing Editor `VCESR`, Designer/Developer `V`, QA/Security
  Reviewer `VR`, Read-Only `V`. No new RBAC migration needed — reused verbatim.
- **Canonical spec:** `03_Detailed_Module_Specifications.md` §24 (lines 154–156) — the only field
  list source:
  > **Fields:** source, target, relationship, anchor, context, link type, priority, status,
  > detector, approver, implementation date, verification date.
- **Data model:** `04_Data_Model_and_Ownership.md`'s "Business and content libraries" section
  names **one single table**, `internal_links` (singular) — unlike Keyword & Entity Library's
  4-table split.
- **No wireframe exists** for this module — matches every prior module's own precedent for an
  unsourced screen (this pass is backend-only regardless, matching every prior module's own
  backend-first precedent).
- **The workflow vocabulary is genuinely NOT sourced in `05_Workflow_State_Machines.md`.**
  Searched exhaustively — the doc's 12 sections cover a generic 8-value artifact lifecycle (§2,
  reused by every module built so far) and 10 other module/entity-specific state machines, none
  of them this module. The "Proposed → Approved → Implemented → Verified" phrase exists only in
  `Recommended_Module_Roadmap.md`'s own advisory text for this module, not in any canonical,
  approved document.

## 1. Design decision confirmed directly with the user (`AskUserQuestion`)

- **D1 — Bespoke 4-state workflow (`proposed`/`approved`/`implemented`/`verified`), chosen over
  reusing the standard 8-value generic lifecycle every prior module shares.** This is the first
  bespoke workflow vocabulary in this codebase — every prior module (Service/Persona/
  Proof-and-Claims/Website-Strategy-Center/Page-Inventory/Keyword-and-Entity-Library) reused the
  identical 8-value `draft`/`submitted`/`under_review`/`approved`/`revision_requested`/`rejected`/
  `superseded`/`archived` vocabulary; none of that reuse is possible here without inventing states
  the roadmap never asked for. Chosen specifically because an internal link has a real physical
  lifecycle (proposed → reviewed → actually placed on the page → confirmed live) the generic
  content-approval vocabulary has no concept for.

## 2. Design decisions made directly (not asked — matching this project's own precedent for

judgment calls on an unsourced module)

- **D2 — Transition table** (new — no prior module's `TRANSITIONS` table can be reused, since the
  states themselves differ):
  - `proposed → approved`: requires `approve`.
  - `approved → implemented`: requires `submit` (the editor who actually places the link).
  - `implemented → verified`: requires `review` (QA/security reviewer confirms it's live and
    correct — the one state in this workflow where that role has a natural, sourced fit).
  - One backward step from each non-initial state, for correcting a mistake without inventing new
    states: `approved → proposed` (`approve`, since only an approver should be able to un-approve
    their own decision), `implemented → approved` (`submit`, the editor's own undo),
    `verified → implemented` (`review`, the same role that verified it in the first place).
  - No archival/deletion mechanism in this pass — the chosen 4-state model has no terminal
    "no longer needed" state, and this project's standing no-hard-delete discipline (ADR-0016)
    applies to an audited, lifecycle-tracked record like this one (unlike Keyword & Entity
    Library's `entities`, which are lightweight reference records by explicit design). Flagged as
    a known, deliberately out-of-scope gap for this pass, not silently omitted.
  - `implementedAt`/`verifiedAt` are server-stamped automatically by the corresponding status
    transition (mirroring `createdAt`/`updatedAt`'s own server-managed contract), never accepted
    as caller input — the "implementation date"/"verification date" fields the spec names are the
    record of when each transition actually happened, not a claim the caller can backdate.
- **D3 — `internal_links` is a single project-scoped table**, no sub-resource/join tables (unlike
  Keyword & Entity Library) — a link IS the relationship (source page → target page), it has no
  independent sub-resources of its own. Project-scoped for the same reason Page Inventory and
  Keyword & Entity Library are: both `sourcePageId`/`targetPageId` reference project-scoped
  `pages` rows, so scoping the link to the same project keeps the whole model coherent.
- **D4 — `sourcePageId`/`targetPageId` are real, existence-and-same-project-validated FKs into
  Page Inventory's own `pages` table**, via the already-established `PagesService.existsInProject()`
  delegating method (built for exactly this cross-module pattern during the Keyword & Entity
  Library build) — matches the roadmap's own explicit instruction ("Use stable Page IDs... Do not
  silently create links to nonexistent pages"). A link may not have `sourcePageId ===
targetPageId` (a page cannot link to itself) — enforced at the service layer with a clean 400,
  not a database constraint (no existing sibling precedent for a same-table self-reference CHECK,
  and the check needs no cross-row query).
- **D5 — `relationship`/`anchor`/`context`/`linkType`/`detector` stay free text, no enum
  invented.** The spec names these as fields but gives no discrete value list for any of them —
  the same discipline this project applied to Keyword & Entity Library's `keywordType`/`intent`
  and every other ambiguous categorical field across this codebase's history. `context` gets a
  generously-sized `TEXT` column (a placement/surrounding-context description could reasonably run
  to a paragraph) with a Zod `.max(2000)` cap; the others stay short (`VARCHAR(255)`).
- **D6 — `priority` is a 3-value string enum (`low`/`medium`/`high`).** No numeric or discrete
  scale is given in the spec, but "priority" is unambiguously ordinal — matches Keyword & Entity
  Library's own `confidence` field precedent for the identical shape of unsourced-but-clearly-
  ordinal field.
- **D7 — `approver` is `assignedApproverUserId`, a nullable, existence-validated FK into
  `users`.** Read as "who is expected to review this link" (an assignment), distinct from the
  actual audit-trail record of who performed the `approve` action (already captured via
  `AuditService`) — matches the same "assign, don't just audit" reasoning behind Projects' own
  `ownerUserId` field. Existence-validated via `UsersService.findById()` (mirroring
  `ProjectService.assertOwnerExists()`'s own precedent), not the "unvalidated string array"
  pattern reserved for fields whose target module doesn't exist yet — `users` obviously already
  exists.
- **D8 — A `relatedStrategyRecordId` field stores an unvalidated reference to a
  `website_strategy_records` row** (typically one of `record_type = "internal_link_plan"`),
  addressing the roadmap's own cycle note that "internal-link records reference the strategy that
  justified them." Stored as a plain, unvalidated UUID-shaped string — the same "store now,
  validate later" pattern already established repeatedly (Service Library's `icpIds`, Persona
  Library's `relatedServiceIds` before their targets existed) — because Website Strategy Center
  was already shipped without a validation hook for this exact relationship, and retrofitting one
  means editing already-reviewed, already-live code, out of scope for this module's own build.
- **D9 — No confidentiality/redaction mechanism.** The registry's own seeded
  `confidentialityLevel` for this module is `null` — matches Persona Library's and Proof and
  Claims Library's own identical precedent (no confidential-field mechanism built for either).

## 3. Schema (migration `00062`)

- **`internal_links`** — `id`, `projectId` (FK → `projects`, required), `publicId` (unique),
  `sourcePageId` (FK → `pages`, required, existence-and-project-validated),
  `targetPageId` (FK → `pages`, required, existence-and-project-validated, ≠ `sourcePageId`),
  `relationship` (`VARCHAR(255)`, nullable), `anchor` (`VARCHAR(255)`, nullable), `context`
  (`TEXT`, nullable), `linkType` (`VARCHAR(255)`, nullable), `priority`
  (`low`/`medium`/`high`, nullable), `status` (`proposed`/`approved`/`implemented`/`verified`,
  default `proposed`), `detector` (`VARCHAR(255)`, nullable), `assignedApproverUserId`
  (nullable FK → `users`), `relatedStrategyRecordId` (nullable, unvalidated UUID-shaped string),
  `implementedAt`/`verifiedAt` (nullable, server-stamped only),
  `createdBy`/`updatedBy`/`createdAt`/`updatedAt`.

Migration `00063` marks `module_registry.implementation_status = 'in_development'` for
`internal_linking_library`, matching every prior module's own "mark in development" migration.

## 4. RBAC / authorization

`MODULE_KEY = "keyword_internal_links"` (same constant Keyword & Entity Library's own services
already use — literally the identical string, confirmed reused not duplicated). Every controller
method carries a method-level `@RequirePermission` decorator (never class-level). The `status`
transition route is gated dynamically per-transition (approve/submit/review), matching every
sibling module's layered RBAC check, and `projectId` is threaded into the dynamic check — the
exact gap Page Inventory's own code review caught once and every module since has correctly
avoided.

## 5. Backend-only pass

No `dashboard-web` UI in this pass — matches every prior module's own backend-first precedent.
