# Service Library — Backend (as-built)

See `docs/task-packages/module-service-library.md` for the full scoping account (D1–D9) — this
document records what was actually built and how it was validated.

## 1. Why this exists, and what it isn't

The third real business-module backend built on the Phase 1F application shell / canonical module
registry, after Projects and Business Knowledge Center. Not started automatically — built directly
on the explicit "Start Service Library module" instruction, module #3 in the project-owner-supplied
`canonical-inputs/Recommended_Module_Roadmap.md` (right after Projects and Business Knowledge
Center, both already live).

**This is backend only.** No `dashboard-web` UI exists yet, matching both the Projects and BKC
modules' own precedent — a separate, not-yet-requested next step.

## 2. Key facts from scoping (task package D1–D9)

- **Roadmap/dependency conflict, resolved directly with the user (D1):** the module registry's own
  seeded `dependencies` field for `service_library` names `persona_library`/`case_study_library`/
  `page_inventory` — none of which are built yet — while the advisory roadmap wants Service Library
  built now, third overall. Asked directly; the user chose **build now, store the three
  cross-module relationship fields (`icpIds`/`relatedPageIds`/`relatedCaseStudyIds`) as plain
  unvalidated string-array columns**, no foreign key, to be properly linked once those modules
  exist later.
- **Pure DB-backed CRUD (D2)**, following BKC's own D1 precedent — no Git+Postgres split, despite
  an advisory-only roadmap note suggesting one with no basis in the canonical spec.
- **A real normalized 7-table schema (D3)** — the opposite of BKC's single-generic-table design —
  sourced from `04_Data_Model_and_Ownership.md:107-118`'s explicit table list, corroborated by the
  advisory `WebDesk_Service_SEO_Library_Templates_v4.xlsm` workbook's own matching sheets (schema
  reference only, per WDS-014).
- **Organization-wide, not project-scoped (D4)** — no `project_id` column anywhere in this schema.
- **Two status fields with different governance (D5):** `approvalStatus` (governed — draft →
  submitted → under_review → approved/revision_requested/rejected → superseded/archived, per
  `05_Workflow_State_Machines.md §2`'s generic lifecycle) with content authoring (`create`/`update`)
  split from status governance (`changeApprovalStatus`), mirroring BKC's own D4; `publicationStatus`
  (ungoverned plain data field — no dedicated endpoint or `P` grant exists in the seeded
  `service_persona_proof` permission group).
- **Field set from the canonical spec (D6)**, corrected for one proven omission (`deliverables`,
  present in `04` but missing from `03:134`'s own field list).
- **Adopts `public_id` (D7)** — unlike BKC, which omitted it — per `04:9`'s base-entity standard and
  the Projects module's own precedent.
- **Complementary to BKC's `service_taxonomy`/`engagement_model` record types (D8)** — BKC holds
  narrative documents about services; Service Library holds the structured catalog. No BKC code
  changed.
- **No hard delete (D9)** — matches Projects/BKC/ADR-0016.

## 3. What exists

**Migration `00050`** — 7 tables (`service_categories`, `deliverables`, `platforms_technologies`,
`engagement_models`, `services`, plus 3 join tables: `service_deliverables`, `service_platforms`,
`service_engagement_models`), a `pg_trgm` extension + GIN trigram index on `services.canonical_name`
(the first real use of Postgres trigram fuzzy-search in this codebase, per
`04_Data_Model_and_Ownership.md:241`'s requirement), unique indexes on both category/service
`public_id`, and unique composite indexes on each join table's `(service_id, *_id)` pair. Migration
`00051` marks `module_registry.implementation_status = 'in_development'` for `service_library`
(matching the `00044`/`00048` precedent).

**`packages/database/src/service-library/`** — entities, a `getServiceLibraryModels()` factory
(WeakMap-cached, mirrors the Projects/BKC pattern), and 6 repository classes:
`ServiceCategoryRepository`, `DeliverableRepository`, `PlatformTechnologyRepository`,
`EngagementModelRepository` (three near-identical dimension-table repositories),
`ServiceRelationshipRepository` (manages all 3 join tables — `replaceDeliverables()`/
`replacePlatforms()`/`replaceEngagementModels()`, each a transactional destroy-then-bulkCreate),
and `ServiceRepository` (the main entity — `create`/`findById`/`findByPublicId`/`list`/`update`/
`updateStatus`). `updateStatus()` uses the same atomic compare-and-swap pattern as
`BusinessKnowledgeRecordRepository.updateStatus()` — `model.update({...}, {where: {id,
approvalStatus: expectedCurrentStatus}})`, returning a discriminated `updated`/`not_found`/
`conflict` result. Both `index.ts` and `index.cjs.ts` (the dual ESM/CommonJS barrel) export the new
module, per the standing CLAUDE.md Caution.

**`apps/dashboard-api/src/service-library/`** — `ServicesService`/`ServicesController` (the main
CRUD + status-transition surface) and `ServiceLibraryDimensionsService`/
`ServiceLibraryDimensionsController` (read-only list routes for the 4 dimension tables — authoring
them is deferred, task package §3/§7). `ServiceLibraryModule` is registered in `AppModule`.

`ServicesService.findById()` enriches the entity with `deliverableIds`/`platformIds`/
`engagementModelIds` (resolved via `Promise.all` against `ServiceRelationshipRepository`) — without
this, `create()`/`update()` accepting those three fields to _set_ the relationships would be
write-only, with no way for a client to read back what's actually linked. A private
`findServiceOrThrow()` helper carries the lean existence check (no relationship enrichment) used
internally by `update()`/`changeApprovalStatus()`, so those calls don't pay for 3 unneeded queries
on every write.

## 4. The three-tier RBAC status-transition split (D5)

`ServicesController`'s `POST /:id/status` route is gated only on `service_persona_proof:view` at
the route level (`@RequirePermission`) — the real per-transition check happens dynamically inside
`ServicesService.changeApprovalStatus()`, the same layered pattern `ProjectApproversService.assign()`
already established for the Projects module. `requiredActionForTransition()` maps each transition
to one of three real, seeded actions (`00013-seed-rbac-matrix.ts:50,181-189`):

| Role                    | Grants  | submit | review | approve |
| ----------------------- | ------- | ------ | ------ | ------- |
| `super_admin`           | VCERAMX | ✗      | ✓      | ✓       |
| `owner_growth_approver` | VCERAX  | ✗      | ✓      | ✓       |
| `marketing_editor`      | VCESR   | ✓      | ✓      | ✗       |
| `qa_security_reviewer`  | VR      | ✗      | ✓      | ✗       |
| `read_only`             | V       | ✗      | ✗      | ✗       |

Notably **neither `super_admin` nor `owner_growth_approver` holds "submit"** — only
`marketing_editor` does. This was caught by an e2e test that initially assumed `super_admin` could
submit on another role's behalf and failed with a real `403`; the test was corrected to route
submission through a real `marketing_editor` session, matching the actual seeded matrix rather than
an assumption about it.

## 5. A real bug the e2e suite caught before merge

`ServiceLibraryDimensionsController` was first written with `@RequirePermission(MODULE_KEY,
"view")` at the **class** level (alongside `@UseGuards(SessionGuard, PermissionGuard)`). This
compiled and typechecked cleanly, but `PermissionGuard.canActivate()` only reads
`context.getHandler()` — a deliberate fail-closed design (a route guarded by `PermissionGuard` with
no method-level `@RequirePermission` throws `InternalServerErrorException`, "developer forgot to
declare what's required," rather than silently allowing everything). Every dimension-list route
would have 500'd in production. Caught immediately by the new e2e suite's dimension-endpoint test;
fixed by moving `@RequirePermission` down to each individual method, matching every other
controller in this codebase (`ServicesController` already did this correctly).

## 6. Validation

- **Unit**: 17 new `dashboard-api` tests (`services.service.spec.ts`) — 447/447 `dashboard-api`
  unit tests overall (430 baseline + 17 new).
- **Integration** (real disposable PostgreSQL 17, `packages/database`): 21 new tests
  (`module-service-library.integration.test.ts`) — category self-nesting, all 3 dimension-table
  repositories, the `category_id` RESTRICT FK, array-column round-trips for `icpIds`/
  `relatedPageIds`/`relatedCaseStudyIds`, `list()` filters/limit-clamping, `update()` never touching
  `approvalStatus`, the atomic CAS `updateStatus()` (`updated`/`not_found`/`conflict`), an invalid
  ENUM rejection, and the join-table replace/clear/cascade-delete/unique-index behavior.
- **E2e** (real disposable PostgreSQL 17 + real seeded RBAC roles, `dashboard-api`): 15 new tests
  (`service-library.e2e-spec.ts`) — 401 with no session, super_admin create/get/list/update,
  read_only 403 on create / 200 on list, category-not-found 400, the full relationship round-trip
  (create with `deliverableIds`/`platformIds`/`engagementModelIds`, `GET :id` confirming them, then
  clearing one and confirming the others are untouched), the three-tier RBAC transition matrix
  (marketing_editor submit+review, denied approve; owner_growth_approver denied submit, then
  review+approve once submitted by a real marketing_editor; qa_security_reviewer view+review only),
  an invalid-transition 400 (archived is terminal), a 404 for a nonexistent id, a 400 for a
  malformed id, a 403 for a mutating request with no `Origin` header, and the 4 dimension-list
  routes (200 for an authenticated `read_only` session, 401 with none).
- Migration `00050`/`00051` up/down round-trip verified clean (51 migrations total) via both the
  test suites' own programmatic `buildMigrator()` round-trips and a direct CLI `pnpm run migrate`
  run against a fresh local disposable database.
- `pnpm run validate:module-registry`: "Module-registry validation passed — 43 modules, 21
  permission groups, all references resolve" (unaffected by this branch).
- `tsc --noEmit`, `eslint --max-warnings=0`, `nest build` (confirms the full NestJS DI module graph
  resolves with `ServiceLibraryModule` newly registered), and `pnpm exec prettier --check` all
  clean across every touched file in `apps/dashboard-api` and `packages/database`.

## 7. Known, out-of-scope gaps (flagged, not built)

- **No authoring UI/API for the 4 dimension tables** (categories/deliverables/platforms/engagement
  models) — read-only in this pass, per task package §3/§7. A service is a real service regardless
  of a discovered dimension row; V1 ships without a way to create them beyond direct database
  seeding.
- **`icpIds`/`relatedPageIds`/`relatedCaseStudyIds` are genuinely unvalidated** (D1) — no format or
  existence check, since `persona_library`/`page_inventory`/`case_study_library` don't exist yet.
  Proper FK-backed linking is deferred until those modules are built.
- **No `dashboard-web` UI** — backend only, matching the Projects/BKC precedent.
