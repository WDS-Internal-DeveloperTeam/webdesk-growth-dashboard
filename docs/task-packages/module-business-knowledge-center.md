# Business Knowledge Center — Task Package

**Status:** Authorized to build directly ("start the business knowledge center now", followed by an
explicit architecture confirmation — see §4 D1). Backend only in this pass, matching the Projects
module's own precedent (backend shipped first; `dashboard-web` UI followed as separate, later
slices).

## 0. Pre-implementation verification

| Check                                   | Result                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Roadmap wave/dependencies               | Wave 1 ("no dependencies", `docs/phase-plans/module-implementation-roadmap.md:47`); registry `dependencies: null` (`00035-populate-module-registry-fields.ts:115`)                                                                                                                                                                                                             |
| Real `module_registry` row              | Exists — `key=business_knowledge_center`, seeded in `00015-seed-module-registry.ts:18-22` and `00035-populate-module-registry-fields.ts:106-118`. No new registry migration needed.                                                                                                                                                                                            |
| Permission group + seeded grants        | `business_knowledge` permission group already seeded with real grants matching `06_Roles_and_Permissions.md §3` row "Business Knowledge" exactly — `00013-seed-rbac-matrix.ts:41,100-108`. No new RBAC seed migration needed.                                                                                                                                                  |
| Module's real field/workflow spec       | **Thin.** `03_Detailed_Module_Specifications.md:34-38` names 10 "primary records" and a 5-value status vocabulary, but no field-level schema, no workflow state machine (`05_Workflow_State_Machines.md`: zero hits), no wireframes (`07_Low_Fidelity_Wireframes.md`: zero hits). Design decisions below (§4) fill this gap explicitly, flagged as proposed, not spec-sourced. |
| Integrations not yet built              | None required for the chosen architecture (pure DB-backed, no GitHub dependency — see §4 D1).                                                                                                                                                                                                                                                                                  |
| Current gate state                      | `G4-subresource-editing` (last approved gate, 2026-08-20)                                                                                                                                                                                                                                                                                                                      |
| No open Critical/High security finding  | Confirmed — no open findings recorded in `project.json`                                                                                                                                                                                                                                                                                                                        |
| No missing production secret/credential | N/A — no new external integration                                                                                                                                                                                                                                                                                                                                              |

## 1. Authorization

Built directly on the explicit "start the business knowledge center now" instruction, following a
scoping conversation (`AskUserQuestion`) that resolved the one real architectural ambiguity before
any code was written — see §4 D1.

## 2. Branch

`module-business-knowledge-center`, off `main` at `621fed8` (the commit recording gap (5)'s
deferral and item 27's merge).

## 3. Scope

**In scope:** a single new backend module (`apps/dashboard-api/src/business-knowledge/`,
`packages/database/src/business-knowledge/`) providing CRUD + status-governance for
"business knowledge records" — the 10 primary-record types named in the canonical spec, modeled as
rows in one table rather than 10 bespoke tables (§4 D2). List/get/create/edit/status-transition
endpoints, RBAC-wired against the already-seeded `business_knowledge` permission group, unit +
integration + e2e tests. No `packages/shared-types` additions in this pass — matching the Projects
module's own backend-first precedent, those are deferred to the `dashboard-web` UI-building slice
that will actually consume them.

**Explicitly out of scope:**

- `dashboard-web` UI — a separate, not-yet-requested next step, matching the Projects module's own
  backend-first precedent.
- Export (`X` grant exists for `super_admin`/`owner_growth_approver`, but no format is specified
  anywhere — CSV/JSON/PDF is unstated). Flagged, not built.
- Module configuration (`M` grant exists for `super_admin` only, but no configuration concept is
  described anywhere for this module). Flagged, not built.
- A distinct "review" checkpoint/status (the `R` grant exists, but the 5-value status vocabulary
  has no "under review" state, and no workflow doc describes one). Flagged, not built — see §4 D4.
- Any Git-backed document storage (the advisory roadmap's "Git owns approved durable docs" note —
  explicitly rejected per the user's own confirmed choice, §4 D1).
- Any per-project scoping (§4 D1 — this module's records are org-wide, not tied to a `projects` row).

## 4. Design decisions

**D1 — Storage architecture: pure DB-backed CRUD, not Git+Postgres hybrid.**
The canonical spec never mentions Git; the Git/Postgres split exists only in the advisory,
reference-only `canonical-inputs/Recommended_Module_Roadmap.md:36`, which this project's own
precedence rules require surfacing rather than silently adopting. Presented directly
(`AskUserQuestion`); the user chose pure DB-backed CRUD, the same pattern as the already-built
Projects module, after confirming realistic storage sizing (all ten primary-record types are
text/structured business content, not files — tens to low-hundreds of KB per record set, tens of MB
at full scale, negligible next to this project's existing `audit_events`/`sessions` tables).

**D2 — One generic table, not ten bespoke ones.**
`03_Detailed_Module_Specifications.md §3`'s own "Rules" text frames every primary-record type
uniformly as a "document" carrying one shared status vocabulary
(`Mandatory | Advisory | Draft | Deprecated | Restricted`) — no field-level differentiation between
record types is stated anywhere. Building 10 separate tables now, with zero spec basis for how their
schemas should actually differ, would be inventing structure the spec doesn't support. Proposed
instead: one `business_knowledge_records` table with a `record_type` enum discriminator (§5) and a
uniform `title` + `content` (free text) shape. If a specific record type later needs real structured
fields (e.g. a persona's demographic breakdown), that's a natural, additive follow-up once real
requirements exist — not a blocker to shipping V1.

**D3 — Scope: organization-wide, not project-scoped.**
This project's tenant model is single-organization (`project.json`'s `tenant.mode: "per-client"` —
"this one WebDesk instance, not a multi-tenant SaaS scope"). The record types themselves (company
profile, VTO, marketing profile, strategic priorities) describe the one client organization as a
whole — they don't naturally vary per `projects` row the way Roadmap items or Environments do. No
`project_id` column; no project-scoping FK. This is the single biggest judgment call in this
package, made without a sourced spec citation — flagged explicitly here for the review process to
catch if wrong, the same way Projects' own D1-D8 decisions were flagged for confirmation rather than
silently assumed correct.

**D4 — Status transitions modeled as the workflow, matching the RBAC matrix's real letter grants.**
`06_Roles_and_Permissions.md §3`'s "Business Knowledge" row grants `marketing_editor` exactly
`VCES` (view, create, edit, submit) and withholds `R`/`A` (review, approve) — while
`owner_growth_approver`/`super_admin` hold the full `R`/`A` set. Proposed mapping, since no workflow
doc exists to source this from: content authoring (`create`/`edit`) is separated from status
governance (`approve`) into two different endpoints, so the RBAC distinction is actually
enforceable:

- `POST .../records` (create) and `POST .../records/:id/update` (edit title/content/notes only,
  never status) — gated on `create`/`edit` respectively. New records always start `draft`.
- `POST .../records/:id/status` (a dedicated transition endpoint, mirroring
  `POST /projects/:projectId/status`'s own precedent) — gated on `approve`. This is the only way a
  record's status ever changes: `draft → mandatory`, `draft → advisory`, any non-terminal status
  `→ deprecated`, any status `→ restricted`. `marketing_editor` can author content but can never
  self-approve a record into `mandatory`/`advisory` — matching the RBAC matrix's real intent and
  this project's own separation-of-duties precedent (ADR-0010) more directly than a single
  "edit-includes-status" endpoint would.
- `submit` (the `S` grant `marketing_editor` holds) is not a separate endpoint — it's read here as
  `marketing_editor`'s own name for "author a draft," already covered by `create`/`edit`. No
  distinct "submitted" status exists in the vocabulary to justify a separate transition.
- `review` (the `R` grant) has no code path — flagged as a real, out-of-scope gap (§3), not
  silently absorbed into `approve`.

**D5 — `record_type` enum values**, taken verbatim from the spec's own "Primary records" list
(`03_Detailed_Module_Specifications.md:36`), snake_cased: `company_profile`, `persona_icp`,
`marketing_profile`, `vto`, `service_taxonomy`, `engagement_model`, `approved_messaging`,
`competitor`, `geographic_scope`, `strategic_priority`.

**D6 — No hard delete.** Matches ADR-0016's project-wide no-hard-delete policy, already established
for Projects. `deprecated` status is the retirement mechanism — no `DELETE` route exists.

## 5. Data model

`business_knowledge_records` (migration `00047`):

| Column                      | Type                                                                | Notes           |
| --------------------------- | ------------------------------------------------------------------- | --------------- |
| `id`                        | UUID PK                                                             |                 |
| `record_type`               | ENUM (10 values, §4 D5)                                             | not nullable    |
| `title`                     | VARCHAR(255)                                                        | not nullable    |
| `content`                   | TEXT                                                                | not nullable    |
| `status`                    | ENUM (`mandatory`, `advisory`, `draft`, `deprecated`, `restricted`) | default `draft` |
| `notes`                     | TEXT                                                                | nullable        |
| `created_by`                | UUID FK → `users.id`, `ON DELETE SET NULL`                          | nullable        |
| `updated_by`                | UUID FK → `users.id`, `ON DELETE SET NULL`                          | nullable        |
| `created_at` / `updated_at` | TIMESTAMPTZ                                                         |                 |

Indexes: `(record_type)`, `(status)`.

## 6. Permissions

Reuses the already-seeded `business_knowledge` permission group verbatim — see §0. No new RBAC
migration.

## 7. API surface

- `GET /business-knowledge/records` — list, optional `?recordType=`/`?status=` filters — `view`
- `GET /business-knowledge/records/:id` — get one — `view`
- `POST /business-knowledge/records` — create (always starts `draft`) — `create`
- `POST /business-knowledge/records/:id/update` — edit `title`/`content`/`notes` — `edit`
- `POST /business-knowledge/records/:id/status` — status transition (§4 D4) — `approve`

## 8. Testing

Unit tests for the service (hand-rolled mock repository, matching `project-objectives.service.spec.ts`'s
pattern) and real-database integration tests for the repository; e2e tests reusing the Projects
module's own harness (real disposable Postgres, real seeded RBAC roles, `super_admin` positive path

- `read_only` negative path, plus a `marketing_editor` case proving they can create/edit but get
  `403` on the status-transition route).

## 9. Documentation deliverables

This task package; `docs/implementation/module-business-knowledge-center.md` (as-built record, to
follow once implementation is complete). No `packages/shared-types` changes — see §3.

## 10. Open items requiring human decision before or during implementation

None outstanding — D1 (the only genuinely open question) was resolved directly with the user before
this package was written. D2-D6 are proposed design decisions, not blocking questions; they're
flagged here for the same review process (code review → security review → second-role human review
→ gate) every prior module has gone through, not for a separate pre-approval step.
