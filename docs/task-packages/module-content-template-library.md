# Task Package: Content Template Library (module #10)

**Status:** Scoped, authorized to build. Not yet implemented.

## 0. Pre-implementation verification

- **Roadmap position:** module #10 on `canonical-inputs/Recommended_Module_Roadmap.md` (Wave 2),
  recommended-for-reference-only per WDS-014 — this task package is the actual authorization
  record, not the roadmap entry itself.
- **Dependency-computed wave:** `docs/phase-plans/module-implementation-roadmap.md` places
  `content_template_library` in **Wave 1** (no dependencies) — no blocker, genuinely simpler than
  the roadmap's own Wave 2 placement suggests.
- **Module registry:** `module_registry.key = "content_template_library"`,
  `route = "/content-template-library"`, `navigationGroup = "libraries"`,
  `navigationOrder = 21`, `implementationStatus = "not_started"` (migration `00035`),
  `dependencies = null`, `confidentialityLevel = null`.
- **RBAC:** `permissionGroupKey = "page_content"` (migration `00015`) — **this module is the
  first real consumer of this permission group.** The only other module seeded to share it,
  `page_workspace`, is not yet built. Real seeded grants (`00013-seed-rbac-matrix.ts`, lines
  127–135): Super Admin `VCERAPX`, Owner/Growth Approver `VCERAPX`, Marketing Editor `VCESR`,
  Designer/Creative Reviewer `VR`, Developer `V`, QA/Security Reviewer `VR`, Read-Only `V`. No new
  RBAC migration needed — reused verbatim.
- **Canonical spec:** `03_Detailed_Module_Specifications.md` §25 (line 160) — the only field list
  source:
  > **Fields:** page type, purpose, required/optional sections, proof rules, SEO/AEO/GEO
  > requirements, schema, CTA rules, content-depth guidance, approval, version.
- **Data model:** `04_Data_Model_and_Ownership.md`'s "Business and content libraries" section
  names **one single table**, `content_templates` — matches Business Knowledge Center's/Persona
  Library's/Website Strategy Center's single-table precedent, not Service Library's 7-table split.
- **No wireframe or bespoke workflow-state-machine entry exists** for this module — searched
  `07_Low_Fidelity_Wireframes.md` and `05_Workflow_State_Machines.md` exhaustively, no match in
  either. Unlike Internal Linking Library, nothing here motivates a bespoke workflow — the
  standard 8-value `ArtifactApprovalStatus` vocabulary fits "approval" as named in the spec's own
  field list with no gap.
- **`P` (Publish/Unpublish) is real, previously-unused RBAC vocabulary.** Per `00013-seed-rbac-
matrix.ts`'s own legend, `P` expands to two real actions (`publish`, `unpublish`) — seeded on
  this module's own `page_content` group (and 3 others: `creative_design`, `case_studies`,
  `portfolio`, all still unbuilt), but **no module built so far actually wires a `publish`/
  `unpublish` action into real code** — confirmed via a repo-wide search. This module is the first
  real consumer.

## 1. Design decision confirmed directly with the user (`AskUserQuestion`)

- **D1 — Build a real `publish`/`unpublish` mechanism**, not leave it zero-wired. The spec's own
  field list names only "approval, version" (no "published" field), so this is genuinely inferred
  from the RBAC seed alone, not spec-sourced — flagged as such, not silently invented. The user
  confirmed building it over the zero-wired alternative (the precedent every earlier module with
  an unused action, e.g. confidential-field actions on Persona/Proof-and-Claims Library, followed).

## 2. Design decisions made directly (not asked — matching this project's own precedent for

judgment calls on an unsourced module)

- **D2 — `isPublished`/`publishedAt` are orthogonal to `approvalStatus`**, mirroring Service
  Library's confidentiality-orthogonal-to-approval precedent — a template can be `draft` and
  unpublished, `approved` and published, or `approved` and unpublished (approved but not yet
  released), but never `draft`/`submitted`/`under_review`/`rejected`/`revision_requested` AND
  published: `publish()` rejects with a clean 400 unless `approvalStatus === "approved"`.
  `unpublish()` has no such gate — always allowed regardless of current `approvalStatus`, since an
  operator must always be able to pull a published template down. `publishedAt` is server-stamped
  once via a `COALESCE(published_at, NOW())` SQL literal (mirroring Internal Linking Library's
  `implementedAt`/`verifiedAt` precedent) — never cleared by `unpublish()`, preserving "when was
  this first published" as history. Both `publish()`/`unpublish()` use an atomic compare-and-swap
  on `isPublished` (mirroring Website Strategy Center's/Page Inventory's own CAS pattern),
  returning a clean 409 on a concurrent double-publish/double-unpublish race rather than silently
  succeeding twice.
- **D3 — No automatic unpublish on a later status transition.** A published, `approved` template
  that later moves to `superseded`/`archived` stays published until an operator explicitly
  unpublishes it — flagged as a known, deliberately out-of-scope gap for this pass (inventing an
  automatic side effect between two orthogonal mechanisms with no spec basis for it would be a
  bigger, unrequested design decision than this module's own scope calls for).
- **D4 — `approvalStatus` reuses the standard 8-value `ArtifactApprovalStatus` vocabulary and its
  `TRANSITIONS` table verbatim**, the identical byte-for-byte copy already shared by Service/
  Persona/Proof-and-Claims/Website Strategy Center — the accepted, already-flagged tracked-debt
  duplication pattern, not extracted here either (a shared helper for a 5th/6th consumer remains
  disproportionate for a single-module pass, per every prior module's own identical reasoning).
  `submit`/`review`/`approve` gate dynamically per-transition, matching the real seeded matrix
  split (`marketing_editor` holds submit+review but not approve; `super_admin`/
  `owner_growth_approver` hold approve — and now also publish/unpublish — but not submit).
- **D5 — `version` is a server-managed integer**, incremented as part of the same `UPDATE`
  statement via a Postgres-evaluated `version + 1` literal (mirroring Persona Library's own
  precedent, since the canonical spec names "version" as its own explicit field, identically to
  Persona Library's own spec entry).
- **D6 — `pageType` stays free text, `VARCHAR(255)`, no enum invented** — matches Page Inventory's
  own `pageType` field shape exactly (also free text). Deliberately not a validated FK into Page
  Inventory's `pages` table: a "page type" here is a category label (e.g. "Service Page," "Blog
  Post"), not a reference to any specific page.
- **D7 — `requiredSections`/`optionalSections` are `text[]` arrays of free-text strings**, no enum
  invented for section names (the canonical spec gives no discrete list). No existence validation
  — these are guidance labels, not FK references to any other table.
- **D8 — `purpose`/`proofRules`/`seoAeoGeoRequirements`/`schema`/`ctaRules`/
  `contentDepthGuidance` stay free text, `TEXT` columns capped at `.max(2000)`** — matches Internal
  Linking Library's own `context` field precedent before its `dashboard-web` UI existed (raised
  2000→4000 only once a real rich-text editor gave it a UI, per the 2026-08-22 standing rule).
  This pass is backend-only (see §5), so no rich-text wiring applies yet.
- **D9 — No confidentiality/redaction mechanism.** The registry's own seeded
  `confidentialityLevel` for this module is `null` — matches Persona/Proof-and-Claims/Internal
  Linking Library's own identical precedent.
- **D10 — No hard delete.** Matches ADR-0016's standing no-hard-delete discipline and every prior
  content-library module's own precedent — `archived` is the retirement mechanism.

## 3. Schema (migration `00064`)

- **`content_templates`** — `id`, `publicId` (unique), `pageType` (`VARCHAR(255)`, required),
  `purpose` (`TEXT`, nullable), `requiredSections`/`optionalSections` (`text[]`, nullable),
  `proofRules`/`seoAeoGeoRequirements`/`schema`/`ctaRules`/`contentDepthGuidance` (`TEXT`,
  nullable), `approvalStatus` (8-value `ArtifactApprovalStatus`, default `draft`), `version`
  (integer, default `1`, server-managed), `isPublished` (boolean, default `false`), `publishedAt`
  (nullable, server-stamped only), `createdBy`/`updatedBy`/`createdAt`/`updatedAt`.

Migration `00065` marks `module_registry.implementation_status = 'in_development'` for
`content_template_library`, matching every prior module's own "mark in development" migration.

## 4. RBAC / authorization

`MODULE_KEY = "page_content"` (first real consumer — see §0). Every controller method carries a
method-level `@RequirePermission` decorator (never class-level — the exact bug class Service
Library's own dimensions controller had once and every module since has correctly avoided). The
`status` transition route is gated dynamically per-transition (submit/review/approve), and the new
`publish`/`unpublish` route is gated dynamically on those two actions specifically — both threading
the resolved record's own state into the dynamic check the same way `changeApprovalStatus()`
already does, avoiding the exact gap Page Inventory's own code review caught once.

## 5. Backend-only pass

No `dashboard-web` UI in this pass — matches every prior module's own backend-first precedent.
