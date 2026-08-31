# Design Review Center — module #21

## Scope

The 21st real business-module backend on the Phase 1F application shell / canonical module
registry — module #21 in `docs/phase-plans/module-implementation-roadmap.md`. Built directly on
the explicit "start design review center" instruction.

### Source

`03_Detailed_Module_Specifications.md §19`:

> **Review types:** creative direction, UX, conversion, UI, accessibility by design, responsive
> behavior, component consistency, motion, performance impact.
>
> **Actions:** approve, approve with notes, request revision, reject, supersede.

Module registry seed (`00015-seed-module-registry.ts`): `design_review_center` shares the
`review_center` RBAC permission group with `review_and_approval_center` (already live, module
#11 — a generic polymorphic reviews engine: `reviews`/`review_comments`/`review_decisions`,
`targetModuleKey`/`targetId` with no FK, 4-value status, `approve`/`approve_with_notes`/
`request_revision`/`reject`/`pause`/`resume`/`delegate`). `00035-populate-module-registry-fields.ts`:
`dependencies: ["component_library", "design_token_library", "section_and_pattern_library",
"page_template_library", "wireframe_library", "motion_and_interaction_library"]` — all six already
live except `motion_and_interaction_library` (open PR #86, not yet merged; irrelevant here since
`targetModuleKey`/`targetId` carry no FK by design, matching the generic engine's own precedent).

### Design fork confirmed with the user first (`AskUserQuestion`)

Three options were presented: (1) extend the existing `reviews` table with a nullable
`reviewType` column + a `supersede` action, making Design Review Center a `dashboard-web`-only
filtered view with no new backend; (2) a dedicated `design_reviews`/`design_review_decisions`
table pair mirroring the existing engine's shape but adding `reviewType` and `supersede` natively;
(3) no new schema at all, review type tracked only as a UI convention. **The user chose option
(2)** — keeps the already-shipped, already-reviewed Review and Approval Center schema untouched,
matching this project's own precedent of accepting some duplication across sibling modules over
destabilizing a live one.

### Design decisions

- **D1 — Two tables**: `design_reviews` (workflow record) and `design_review_decisions` (append-
  only local history) — no `design_review_comments` table; the spec's Design Review Center section
  names no comment/discussion capability (unlike Review and Approval Center's own spec line, which
  explicitly names "comments"). Not built.
- **D2 — `reviewType`**: a 9-value enum taken verbatim from §19: `creative_direction`, `ux`,
  `conversion`, `ui`, `accessibility_by_design`, `responsive_behavior`, `component_consistency`,
  `motion`, `performance_impact`. Immutable after creation (no route to change it) — a real
  `reviewType` change is a different review, not an edit, mirroring `recordType`'s own immutability
  in every generic-table module (Business Knowledge Center, Brand Library, etc.).
- **D3 — `status`**: 5 values — `submitted`, `revision_requested`, `approved`, `rejected`,
  `superseded`. `approved`, `rejected`, and `superseded` are all terminal. `superseded` is reached
  ONLY automatically (D4), never as a directly-requested `decide()` action — mirroring
  `WebsiteStrategyCenterService`'s own "supersede is an automatic consequence of a new approval,
  not a user-facing action" design (module #6, item 40 in `CLAUDE.md`), not a manual RBAC-gated
  action (the seeded `review_center` RBAC group has no letter for it — legend is V/C/E/R/A only).
- **D4 — Automatic supersede on approve**: when `decide()` produces `status: "approved"`, the
  SAME transaction atomically flips any OTHER row sharing `(targetModuleKey, targetId, reviewType)`
  that is currently `approved` to `superseded` — mirrors
  `WebsiteStrategyRecordRepository`'s own `supersedeOtherApprovedVersion()` exactly (same
  `UPDATE ... WHERE target_module_key = $1 AND target_id = $2 AND review_type = $3 AND status =
'approved' AND id <> $4` shape), scoped to the 3-column tuple instead of a single `recordId`. A
  `design_review_decisions` row with `action: "supersede"`, `actorUserId` = the same actor who
  triggered the approval, is written for the superseded row inside the same transaction — this is
  the only way `action: "supersede"` is ever written; there is no `POST .../supersede` route.
- **D5 — `decide()` actions**: `approve` / `approve_with_notes` / `reject` / `request_revision` —
  the identical 4 actions Review and Approval Center already has, same RBAC gating
  (`approve`/`approve_with_notes`/`reject` require the `approve` action; `request_revision`
  requires only `review`). No `pause`/`resume`/`delegate` — the spec's Actions line for this module
  names none of the three, unlike Review and Approval Center's own spec line, which explicitly
  does; not built.
- **D6 — Separation of duties**: `SeparationOfDutiesService.assertDistinctActors()` before every
  `decide()` write — identical to Review and Approval Center.
- **D7 — `audit_events` mirror**: every `decide()` call (including the automatic supersede side
  effect) is mirrored into `audit_events` — `decide()`'s own primary action as `eventType:
"approval"`, and a second, separate `audit_events` row for the auto-superseded record (if any),
  matching Website Strategy Center's own dual-write shape for its fork/supersede path.
- **D8 — Organization-wide, no `project_id`** — matches the seeded `confidentialityLevel: null`
  and the generic engine's own D7.
- **D9 — `targetModuleKey`/`targetId`**: no FK, `targetModuleKey` validated against the real module
  registry via the existing `AuthorizationService.isValidModuleKey()`, `targetId` existence not
  checked — identical to Review and Approval Center's own D1/D6.
- **D10 — No hard delete, no content edit beyond `decide()`** — identical to Review and Approval
  Center's own D9.

### Files (mirrors `packages/database/src/review-and-approval-center/*` /
`apps/dashboard-api/src/review-and-approval-center/*` file-for-file, adding `reviewType` + the
supersede mechanism)

- Migration `00089-create-design-review-center.ts` (creates `design_reviews`,
  `design_review_decisions`; indexes: `(target_module_key, target_id)`,
  `(target_module_key, target_id, review_type)` for the supersede lookup, `assigned_to_user_id`,
  `status`, `(updated_at, id)`, a `pg_trgm` GIN index on `target_label`)
- Migration `00090-mark-design-review-center-in-development.ts`
- `packages/database/src/design-review-center/{entities,models,entity-mapping,
design-review.repository,design-review-decision.repository,index}.ts`
- `apps/dashboard-api/src/design-review-center/{design-review-center.constants,
design-review-center.dto,database.providers,design-review-center.module,
design-reviews.controller,design-reviews.service,design-reviews.service.spec}.ts`
- Both `packages/database/src/index.ts` AND `index.cjs.ts` barrel exports (this file's own
  documented production-outage lesson)
- `apps/app.module.ts` wiring

Built by a background agent with a fully-specified prompt, then independently re-verified in full
by the orchestrating session — every high-risk file read directly, every test suite re-run against
a fresh local disposable PostgreSQL 17 database, not trusted from the agent's own report.

<!-- As-built section appended after the build and review complete. -->
