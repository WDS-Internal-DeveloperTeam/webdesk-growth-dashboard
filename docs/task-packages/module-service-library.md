# Service Library — Task Package

**Status:** Authorized to build directly ("Start Service Library module"), following a scoping
conversation (`AskUserQuestion`) that resolved the one real architectural conflict before any code
was written — see §4 D1. Backend only in this pass, matching the Projects and Business Knowledge
Center modules' own precedent (backend shipped first; `dashboard-web` UI follows as a separate,
later slice).

## 0. Pre-implementation verification

| Check                                   | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roadmap wave/dependencies               | **Conflict, resolved directly with the user (§4 D1).** Advisory `canonical-inputs/Recommended_Module_Roadmap.md:37` places it Wave 1, order #3. The mechanically-computed `docs/phase-plans/module-implementation-roadmap.md:82,125-127` places it Wave 2, inside a 5-module cycle with `persona_library`/`case_study_library`/`page_inventory`/`case_study_studio`/`proof_and_claims_library` — none of which are built. Registry `dependencies: ["persona_library", "case_study_library", "page_inventory"]` (`00035-populate-module-registry-fields.ts:329`).                                                                        |
| Real `module_registry` row              | Exists — `key=service_library`, seeded in `00015-seed-module-registry.ts:67` and `00035-populate-module-registry-fields.ts:320-332`. No new registry row migration needed; a one-line `mark-in-development` migration is added, matching `00044`/`00048`'s own pattern.                                                                                                                                                                                                                                                                                                                                                                 |
| Permission group + seeded grants        | `service_persona_proof` permission group already seeded with real grants matching `06_Roles_and_Permissions.md:42` exactly — `00013-seed-rbac-matrix.ts:50,181-189`. No new RBAC seed migration needed.                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Module's real field/workflow spec       | **Fields: moderate, workflow/wireframes/acceptance-criteria: absent.** `03_Detailed_Module_Specifications.md:130-136` names 16 core fields (no types, no vocabularies) plus 2 unenumerated status attributes; `04_Data_Model_and_Ownership.md:107-118` prescribes a normalized 7-table relational shape (corroborated by the advisory workbook's own 6 matching sheets). `05_Workflow_State_Machines.md` and `07_Low_Fidelity_Wireframes.md` and `11_Acceptance_Criteria_and_Test_Plan.md`: zero hits each. Design decisions below (§4) fill these gaps explicitly, flagged as proposed, not spec-sourced, except where directly cited. |
| Integrations not yet built              | None required for the chosen architecture (pure DB-backed, no GitHub/import dependency — see §4 D2).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Current gate state                      | `G4-attachments-on-create` (last approved gate, 2026-08-21)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| No open Critical/High security finding  | Confirmed — no open findings recorded in `project.json`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| No missing production secret/credential | N/A — no new external integration. (One unrelated open blocker exists — a missing Vercel Blob store, `commit b7fdc95` — irrelevant here since this module has no file attachments.)                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

## 1. Authorization

Built directly on the explicit "Start Service Library module" instruction (module #3 in the
user's own Recommended Module Roadmap), following a scoping conversation (`AskUserQuestion`) that
resolved the one real architectural conflict — the roadmap-wave/dependency gap — before any code
was written. See §4 D1.

## 2. Branch

`module-service-library`, off `main` at `b7fdc95` (the commit recording the missing-Vercel-Blob-store
open blocker).

## 3. Scope

**In scope:** a single new backend module (`apps/dashboard-api/src/service-library/`,
`packages/database/src/service-library/`) providing CRUD + approval-status governance for the
Service Library's real relational data model: services, service categories, deliverables,
platforms/technologies, engagement models, and the join tables between a service and each of those
three. List/get/create/edit/status-transition endpoints, RBAC-wired against the already-seeded
`service_persona_proof` permission group, unit + integration + e2e tests. No
`packages/shared-types` additions in this pass, matching both prior modules' backend-first
precedent — those are deferred to the `dashboard-web` UI-building slice that will actually consume
them.

**Explicitly out of scope:**

- `dashboard-web` UI — a separate, not-yet-requested next step.
- Any pricing/commercial field, hidden or restricted — `03_Detailed_Module_Specifications.md:136`'s
  own Rule excludes it by default, and the proposed (unapproved) UI spec
  (`docs/design/dashboard-ui/15-representative-screen-specifications.md:44-46`) is explicit that
  V1's editor form has no pricing section "not a hidden/restricted one, since none is specified to
  exist yet." If pricing is ever added, `06`'s matrix already reserves `M` (configure) to
  `super_admin` only for exactly that purpose.
- Real foreign keys to `personas`, `case_studies`, or `pages` — those tables don't exist yet
  (`persona_library`/`case_study_library`/`page_inventory` are all unbuilt). Per §4 D1, the
  corresponding fields are stored as unvalidated identifier lists instead.
- "Sales availability" as a governed field — appears only in the advisory workbook
  (`WebDesk_Service_SEO_Library_Templates_v4.xlsm`'s `02_Services` sheet), not in the canonical
  spec's own field list (`03:134`). Not built — see §4 D6.
- "Publication status" as a governed workflow with a dedicated transition endpoint — no vocabulary
  is defined anywhere, and the RBAC matrix grants no `P` (publish/unpublish) to any role in this
  permission group. Modeled as a plain data field instead — see §4 D5.
- Export (`X` grant exists for `super_admin`/`owner_growth_approver`, but no format is specified
  anywhere). Flagged, not built.
- Module configuration (`M` grant exists for `super_admin` only; `03:136`'s "restricted owner-only
  configuration if added later" names a real future purpose — pricing — but nothing to configure
  exists in V1). Flagged, not built.
- Import (module #34, Import/Export Center, a separate module entirely) — the schema is designed
  not to preclude a later import (stable `public_id`s, resolvable relationship keys), but no import
  mechanism is built here.

## 4. Design decisions

**D1 — Roadmap/dependency conflict: build now, store cross-module relationships unvalidated.**
The advisory `Recommended_Module_Roadmap.md` (Wave 1, order #3, "start here" energy inherited from
Projects at #1) and the mechanically-computed `module-implementation-roadmap.md` (Wave 2, inside a
5-module cycle) disagree on when this module is safe to build — both documents' own text requires
surfacing that disagreement to the project owner rather than silently picking one
(`Recommended_Module_Roadmap.md:23-27`; `module-implementation-roadmap.md:133-135`). Presented
directly (`AskUserQuestion`); the user chose to build now, with the fields that would otherwise be
foreign keys to `persona_library`/`case_study_library`/`page_inventory` (ICP tags, related pages,
related case studies) stored instead as plain, unvalidated identifier-list columns — no FK, no
cross-module existence check. This matches the source workbook's own explicit design intent
(`00_README` row 2: "Unresolved relationships may enter dry-run staging, but final import must
block until every referenced ID resolves") and leaves a clean, additive path to real FKs once those
three modules exist.

**D2 — Storage architecture: pure DB-backed CRUD, following the Business Knowledge Center
precedent (D1 there), reinforced here by the canonical spec's own explicit relational schema.**
Unlike Business Knowledge Center, the advisory roadmap doesn't even suggest a Git split for this
module (`Recommended_Module_Roadmap.md:36` names it only for row 2, BKC); `04_Data_Model_and_
Ownership.md`'s ownership matrix (`§3`, lines 217-229) has no row placing service records in Git.
No architectural ambiguity here — following the already-established precedent needed no separate
escalation.

**D3 — A real normalized multi-table schema, not one generic table.**
This is the direct opposite of Business Knowledge Center's own D2 ("one generic table"), and
deliberately so: BKC's spec gave no field-level or relational basis for splitting its 10 record
types, so inventing ten bespoke tables would have been unsupported structure. Service Library's
spec is the opposite case — `04_Data_Model_and_Ownership.md:109-118` explicitly names 7 real
tables (`service_categories`, `services`, `service_deliverables`, `deliverables`,
`platforms_technologies`, `service_platforms`, `engagement_models`, `service_engagement_models`),
corroborated field-for-field by the advisory workbook's own first six sheets (non-authoritative as
data, but explicitly permitted as a schema-shape reference per WDS-014's own carve-out — see
`knowledge/00-scope-and-precedence.md:60`). Building the sourced multi-table shape here, not a
single generic table, is the same discipline as BKC's D2 in the opposite direction: match what the
spec actually supports, not a default habit.

**D4 — Scope: organization-wide, not project-scoped**, for the same reasons as Business Knowledge
Center's own D3: `04:109`'s table group sits under "Business and content libraries," not under
"Projects and configuration" (the six literally `project_*`-prefixed tables the Projects module
itself owns); a "stable" ID is only stable in one flat namespace, matching the workbook's own
single global `SVC-*`/`CAT-*`/`PLATFORM-*`/`EM-*`/`DEL-*` ID scheme across all 2-30 sample rows per
sheet; and these are WebDesk Solution's own services — the one organization's offering, not
something that varies per client project. (One inert counter-signal noted and dismissed: an
unapproved design doc's illustrative empty-state copy says "to this project yet" —
`docs/design/dashboard-ui/07-page-patterns.md:152` — weighted near zero against the three points
above, since it's UI copywriting in a "Proposed, pending approval" reference doc, not a schema
decision.)

**D5 — Two status fields, two different governance models, matching what the RBAC matrix and the
spec's own silence actually support.**

- **`approval_status`** gets a real, governed workflow: adopted directly from
  `05_Workflow_State_Machines.md §2`'s generic artifact lifecycle (`draft → submitted → under_review
→ approved → superseded/archived`, plus `revision_requested` and `rejected` branches) — a sourced
  decision, not an invented one, and a genuine improvement on BKC's own D4 (which had to invent its
  transitions from nothing). `06`'s matrix grants `marketing_editor` real `S`/`R` (submit, review)
  here, unlike BKC's `VCES`-only grant — so `submitted`/`under_review` are real, reachable states,
  not vestigial ones. Content authoring (`create`/`edit`) stays separate from status governance
  (`review`/`approve`) into different endpoints, mirroring BKC's D4 exactly: `marketing_editor` can
  author and submit, but never self-approve into `approved` — matching the RBAC matrix's real
  intent and this project's separation-of-duties precedent (ADR-0010).
- **`publication_status`** stays a plain, ungoverned data field (`draft` / `published` /
  `unpublished`), editable only via the general `update` action — no dedicated transition endpoint,
  because no vocabulary is defined anywhere and, more importantly, the RBAC matrix grants **no `P`
  (publish/unpublish)** to any role in `service_persona_proof` (`06:42`) — unlike `case_studies`/
  `portfolio`/`page_content`/`creative_design`, which do get `P`. Building a governed publish
  workflow with no permission action to gate it on would be inventing an enforcement mechanism the
  matrix doesn't support.

**D6 — Field set taken from the canonical spec, corrected for one proven omission, with the
advisory workbook used only to resolve terse field names into real column types — never to add
fields the canonical spec doesn't name.**
`03:134`'s 16-name Core-fields list is demonstrably non-exhaustive (it omits `deliverables`, which
both `04:111-112` and the roadmap name) — `deliverables` is included as its own real table per D3,
correcting that one proven gap. The workbook's `Sales Availability*` column (a real field in the
sample data) is **not** added — it exists in the advisory sample only, has no canonical-spec
citation, and would be inventing a third status axis the RBAC matrix and spec are both silent on.
Where the workbook's own column names corroborate a spec field's meaning (e.g. "Who It Is For" →
`audience`, "Problems Solved" → `problems`), those are used only to pick a sensible column type
(long `TEXT`, per the workbook's own ~700-character sample cells), never to add scope.

**D7 — `public_id`, unlike Business Knowledge Center (which omitted it).** "Stable Service IDs" is
the roadmap's own defining requirement for this module; `04:9`'s base-entity standard names
`public_id` as the mechanism ("human-readable stable identifier, unique"); and the Projects module
already established the exact precedent this module reuses verbatim
(`00036-create-projects.ts:19-23,80-83`: `STRING(64) NOT NULL`, unique index, "stable, human-readable
identifier — never regenerated once assigned").

**D8 — Boundary against Business Knowledge Center's own `service_taxonomy`/`engagement_model`
record types: complementary, not duplicative — narrative document vs. structured catalog.**
`business_knowledge_records.record_type` already includes `service_taxonomy` and `engagement_model`
as seeded enum values (`00047-create-business-knowledge-records.ts`). Nothing in either module's
spec resolves this overlap explicitly, so it's stated here as a reasoned position, not a silent
assumption: BKC's records are narrative, single-document artifacts (a written policy/philosophy
page, matching its own "one generic table, free-text content" shape, D2 there); Service Library's
`engagement_models` table is a small, structured, individually-addressable catalog of real options
(`EM-PROJECT`, `EM-RETAINER`, `EM-HYBRID`, per the workbook's own 4-row sample) with real fields
(public description, internal rules, approval-required flag). The two are complementary — a BKC
record could describe _why_ WebDesk structures engagement models the way it does; Service Library
holds the actual structured options. No code changes to Business Knowledge Center are needed or
made here.

**D9 — No hard delete.** Matches ADR-0016's project-wide no-hard-delete policy, already established
for both Projects and Business Knowledge Center. `archived` (via `approval_status`) or `unpublished`
(via `publication_status`) are the retirement mechanisms — no `DELETE` route on any table.

## 5. Data model

Seven tables, migration `00050`:

**`service_categories`** — self-nesting.

| Column                      | Type                                        | Notes                        |
| --------------------------- | ------------------------------------------- | ---------------------------- |
| `id`                        | UUID PK                                     |                              |
| `public_id`                 | VARCHAR(64)                                 | unique, not nullable (§4 D7) |
| `name`                      | VARCHAR(255)                                | not nullable                 |
| `parent_category_id`        | UUID FK → `service_categories.id`, nullable | self-referencing             |
| `public_description`        | TEXT                                        | nullable                     |
| `internal_description`      | TEXT                                        | nullable                     |
| `sort_order`                | INTEGER                                     | default 0                    |
| `created_by` / `updated_by` | UUID FK → `users.id`, `ON DELETE SET NULL`  | nullable                     |
| `created_at` / `updated_at` | TIMESTAMPTZ                                 |                              |

**`services`** — the primary entity.

| Column                      | Type                                                                                                                | Notes                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `id`                        | UUID PK                                                                                                             |                                                                 |
| `public_id`                 | VARCHAR(64)                                                                                                         | unique, not nullable                                            |
| `canonical_name`            | VARCHAR(255)                                                                                                        | not nullable                                                    |
| `public_name`               | VARCHAR(255)                                                                                                        | nullable                                                        |
| `category_id`               | UUID FK → `service_categories.id`, `ON DELETE RESTRICT`                                                             | not nullable                                                    |
| `parent_service_id`         | UUID FK → `services.id`, nullable                                                                                   | self-referencing                                                |
| `short_public_description`  | TEXT                                                                                                                | nullable                                                        |
| `audience`                  | TEXT                                                                                                                | nullable — "who it is for"                                      |
| `problems`                  | TEXT                                                                                                                | nullable                                                        |
| `capabilities`              | TEXT                                                                                                                | nullable                                                        |
| `outcomes`                  | TEXT                                                                                                                | nullable                                                        |
| `exclusions`                | TEXT                                                                                                                | nullable                                                        |
| `internal_description`      | TEXT                                                                                                                | nullable                                                        |
| `icp_ids`                   | ARRAY(STRING)                                                                                                       | unvalidated, §4 D1                                              |
| `related_page_ids`          | ARRAY(STRING)                                                                                                       | unvalidated, §4 D1                                              |
| `related_case_study_ids`    | ARRAY(STRING)                                                                                                       | unvalidated, §4 D1                                              |
| `confidentiality`           | ENUM (`public`, `internal`, `restricted`)                                                                           | default `internal`, §4 D6, matches `03:132`'s three named views |
| `publication_status`        | ENUM (`draft`, `published`, `unpublished`)                                                                          | default `draft`, §4 D5                                          |
| `approval_status`           | ENUM (`draft`, `submitted`, `under_review`, `approved`, `revision_requested`, `rejected`, `superseded`, `archived`) | default `draft`, §4 D5                                          |
| `owner_user_id`             | UUID FK → `users.id`, `ON DELETE SET NULL`                                                                          | nullable                                                        |
| `created_by` / `updated_by` | UUID FK → `users.id`, `ON DELETE SET NULL`                                                                          | nullable                                                        |
| `created_at` / `updated_at` | TIMESTAMPTZ                                                                                                         |                                                                 |

Indexes: `(category_id)`, `(approval_status)`, `(publication_status)`, trigram index on
`canonical_name` (matching `04:241`'s fuzzy-search requirement).

**`deliverables`** / **`platforms_technologies`** / **`engagement_models`** — independent
dimension tables, each: `id` UUID PK, `public_id` unique, `name` NOT NULL, `description` TEXT
nullable, plus table-specific fields sourced from the workbook's own header rows for type-shape
only (§4 D6) — `platforms_technologies` additionally carries `platform_type` VARCHAR(nullable) and
`certified_partnership` BOOLEAN (default false); `engagement_models` additionally carries
`preferred` BOOLEAN (default false) and `approval_required` BOOLEAN (default false). No pricing
field anywhere (§3).

**`service_deliverables`** / **`service_platforms`** / **`service_engagement_models`** — pure join
tables: `service_id` FK `ON DELETE CASCADE`, the other side's FK `ON DELETE CASCADE`, composite
unique index on the pair, `created_at`.

## 6. Permissions

Reuses the already-seeded `service_persona_proof` permission group verbatim — see §0. No new RBAC
migration.

## 7. API surface

- `GET /service-library/services` — list, optional `?categoryId=`/`?approvalStatus=`/
  `?publicationStatus=` filters — `view`
- `GET /service-library/services/:id` — get one — `view`
- `POST /service-library/services` — create (always starts `draft`/`draft`) — `create`
- `POST /service-library/services/:id/update` — edit content/relationship/publication fields, never
  `approval_status` — `edit`
- `POST /service-library/services/:id/status` — `approval_status` transition (§4 D5) — `review` for
  `submitted`/`under_review`/`revision_requested`, `approve` for `approved`/`rejected`/
  `superseded`/`archived`
- `GET /service-library/categories`, `GET /service-library/deliverables`,
  `GET /service-library/platforms`, `GET /service-library/engagement-models` — list each dimension
  table (read-only in this pass; authoring them is deferred unless a real need surfaces during
  build) — `view`

## 8. Testing

Unit tests for each service (hand-rolled mock repositories, matching the Projects/BKC precedent),
real-database integration tests for the repositories (including the FK/cascade behavior on the
three join tables), and e2e tests reusing the existing harness (real disposable Postgres, real
seeded RBAC roles) — `super_admin` positive path, `read_only` negative path, and a
`marketing_editor` case proving they can create/edit/submit but get `403` attempting to approve.

## 9. Documentation deliverables

This task package; `docs/implementation/module-service-library.md` (as-built record, to follow once
implementation is complete). No `packages/shared-types` changes — see §3.

## 10. Open items requiring human decision before or during implementation

None outstanding — D1 (the only genuinely open question) was resolved directly with the user
before this package was written. D2–D9 are proposed design decisions, not blocking questions;
they're flagged here for the same review process (code review → security review → second-role
human review → gate) every prior module has gone through, not for a separate pre-approval step.
