# Task Package: Keyword & Entity Library (module #8)

**Status:** Scoped, authorized to build. Not yet implemented.

## 0. Pre-implementation verification

- **Roadmap position:** module #8 on `canonical-inputs/Recommended_Module_Roadmap.md` (Wave 2),
  recommended-for-reference-only per WDS-014 — this task package is the actual authorization
  record, not the roadmap entry itself.
- **Dependency-computed wave:** `docs/phase-plans/module-implementation-roadmap.md` places
  `keyword_and_entity_library` in Wave 3, depending on `website_strategy_center` and
  `page_inventory` — both already shipped and live in production. No dependency conflict, unlike
  some prior modules whose seeded `dependencies` named not-yet-built modules.
- **Module registry:** `module_registry.key = "keyword_and_entity_library"`,
  `route = "/keyword-and-entity-library"`, `navigationGroup = "libraries"`,
  `navigationOrder = 19`, `implementationStatus = "not_started"` (migration `00035`, line
  358–369).
- **RBAC:** `permissionGroupKey = "keyword_internal_links"` — the same group `internal_linking_library`
  will eventually use (not yet built). Real seeded grants (`00013-seed-rbac-matrix.ts` line 190):
  Super Admin `VCERAMX`, Owner/Growth Approver `VCERAX` (no submit), Marketing Editor `VCESR` (no
  approve), Designer/Developer/Read-Only `V`, QA/Security Reviewer `VR`. No new RBAC migration
  needed — reused verbatim, matching Service/Persona/Proof-and-Claims Library's own precedent.
- **Canonical spec:** `03_Detailed_Module_Specifications.md` §23 (lines 148–152) — the only field
  list source:
  > **Fields:** keyword/query, type, intent, funnel, country/location, metrics, tool/source,
  > research date, entity, service/page assignments, cannibalization, approval, confidence.
  > **Rule:** SEO-team data is advisory until Search Strategy and Growth Director review,
  > followed by human approval.
- **Data model:** `04_Data_Model_and_Ownership.md` (lines 121–124) names **4 separate tables**:
  `keywords`, `entities`, `keyword_entity_relationships`, `page_keyword_assignments` — a real
  many-to-many keyword↔entity model plus a join table into Page Inventory's own `pages`.
- **No wireframe exists** for this module — `07_Low_Fidelity_Wireframes.md` wireframes 11 screens,
  none of them this one. Screen design for a future `dashboard-web` UI pass will follow this
  module's own "smallest honest reading" precedent, same as every prior unsourced screen.
- **No workflow-state-machine entry exists** for keywords/entities in
  `05_Workflow_State_Machines.md` — the approval workflow below is this task package's own
  proposal, reusing the identical `TRANSITIONS`-table pattern from Service/Persona/Proof-and-Claims
  Library/Website Strategy Center/Page Inventory (a 6th independent copy — already-accepted,
  out-of-scope debt in this codebase, not re-litigated here).

## 1. Design decisions confirmed directly with the user (`AskUserQuestion`)

- **D1 — Table architecture: full 4-table relational model (chosen over a simplified single-table
  approach).** Both dependencies now exist, so `page_keyword_assignments` gets a real,
  existence-validated FK into `page_inventory.pages` rather than an unvalidated array — unlike
  prior modules (Persona Library's `relatedServiceIds`, etc.) that fell back to plain arrays
  specifically because their target modules didn't exist yet at build time.
- **D2 — Project scoping: `keywords`/`entities` are project-scoped (chosen over
  organization-wide).** Keyword research is inherently tied to a specific client website;
  `page_keyword_assignments` already joins to project-scoped `pages` rows, so scoping `keywords`
  to the same project keeps the whole join coherent.

## 2. Design decisions made directly (not asked — matching this project's own precedent for

field-level judgment calls on unsourced modules)

- **D3 — `entities` are lightweight, project-scoped reference records, not full-lifecycle
  artifacts.** Fields: `name` (required), `entityType` (free text — e.g. "Person", "Organization",
  "Place", "Concept", "Brand" — no enum invented, since the spec names no discrete taxonomy),
  `description` (optional). No `approvalStatus` of their own — mirrors how Proof and Claims
  Library's `claim_sources` sub-resource carries no independent approval workflow.
- **D4 — No confidentiality/redaction mechanism.** The registry's `confidentialityLevel` value
  ("advisory until Search Strategy + Growth Director review + human approval") describes the
  approval workflow, not an access-control tier — it is not one of Service Library's
  `public`/`internal`/`restricted` values. Matches Persona Library's and Proof and Claims
  Library's own identical precedent (both also have a non-standard/absent confidentiality value
  and correctly built no redaction mechanism).
- **D5 — No `version` field.** Not named in the spec, unlike Persona Library's `version`.
- **D6 — Ambiguous categorical fields (`keywordType`, `intent`, `funnelStage`, `country`,
  `source`) stay free text, not enums.** The spec names these as fields but gives no discrete
  value list for any of them; inventing a taxonomy (e.g. a fixed intent enum of
  informational/navigational/commercial/transactional) would be fabricating structure the spec
  doesn't state, the same discipline this project applied to Persona Library's `roles`/
  `industries` (free-text `TagListField`, not enums).
- **D7 — "Metrics" interpreted as `searchVolume` (integer) and `difficultyScore` (integer 0–100).**
  The spec names no exhaustive metric list; these are the two most standard SEO keyword metrics.
  More can be added later without a breaking migration.
- **D8 — "Confidence" is a 3-value string enum (`low`/`medium`/`high`).** No numeric threshold
  basis exists anywhere in the spec to justify a numeric score.
- **D9 — Approval workflow applies only to `keywords` (the primary record), reusing the identical
  8-value `TRANSITIONS` table (`draft`/`submitted`/`under_review`/`approved`/
  `revision_requested`/`rejected`/`superseded`/`archived`) and atomic compare-and-swap
  `updateStatus()` pattern already shipped 5 times in this codebase.** `entities` and both join
  tables carry no approval status of their own.
- **D10 — `page_inventory.pages.targetKeyword` (a free-text field on the existing Page Inventory
  module) is explicitly NOT reconciled with the new `page_keyword_assignments` join table in this
  pass.** Both will coexist; deciding whether `targetKeyword` becomes a denormalized display cache
  of the "primary" assignment, or is deprecated outright, is flagged as its own, not-yet-requested
  follow-up — this task package does not touch already-shipped Page Inventory code beyond adding
  one narrow, read-only `PagesService.existsInProject()`-style delegating method for the
  cross-module FK check (mirrors `RoadmapItemsService.existsInProject()`'s own already-established
  shape from the Page Inventory build itself).

## 3. Schema (migration `00060`)

- **`keywords`** — `id`, `projectId` (FK → `projects`, required), `publicId` (unique), `queryText`
  (required), `keywordType`, `intent`, `funnelStage`, `country`, `searchVolume` (int),
  `difficultyScore` (int), `source`, `researchDate` (date), `cannibalizationNotes` (text),
  `confidence` (`low`/`medium`/`high`), `approvalStatus` (the 8-value enum, default `draft`),
  `createdBy`/`updatedBy`/`createdAt`/`updatedAt`.
- **`entities`** — `id`, `projectId` (FK → `projects`, required), `publicId` (unique), `name`
  (required), `entityType`, `description`, `createdBy`/`updatedBy`/`createdAt`/`updatedAt`.
- **`keyword_entity_relationships`** — `id`, `keywordId` (FK → `keywords`), `entityId` (FK →
  `entities`), unique `(keywordId, entityId)`, `createdBy`/`createdAt`.
- **`page_keyword_assignments`** — `id`, `keywordId` (FK → `keywords`), `pageId` (FK →
  `page_inventory.pages`, existence-and-same-project validated at the service layer), unique
  `(keywordId, pageId)`, `assignmentNote` (optional), `createdBy`/`createdAt`.

Migration `00061` marks `module_registry.implementation_status = 'in_development'` for
`keyword_and_entity_library`, matching every prior module's own "mark in development" migration
pattern.

## 4. RBAC / authorization

`MODULE_KEY = "keyword_internal_links"` (the RBAC group key — distinct from
`module_registry.key = "keyword_and_entity_library"`, the same split precedent Service/Persona/
Proof-and-Claims Library established between their shared `service_persona_proof` RBAC group and
their own individual module-registry keys). Every controller method carries a method-level
`@RequirePermission` decorator (never class-level — the exact bug 3+ prior modules independently
had and fixed). The `approvalStatus` transition route is gated dynamically per-transition
(submit/review/approve), matching every sibling module's layered RBAC check.

## 5. Backend-only pass

No `dashboard-web` UI in this pass — matches every prior module's own backend-first precedent.
