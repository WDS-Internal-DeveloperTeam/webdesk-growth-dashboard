# Task package — Page Workspace (module #12)

> **Status:** scoped and authorized. Built directly on the explicit "Start the Page Workspace"
> instruction (2026-08-25), with all three scoping forks below confirmed directly with the user
> via `AskUserQuestion` before any code was written.

## 0. Pre-implementation verification

| Check                                | Result                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Recommended roadmap position         | Row 12, Wave 3 — `canonical-inputs/Recommended_Module_Roadmap.md`                                      |
| Dependency-computed roadmap position | Wave 2, depends on `page_inventory` only — `docs/phase-plans/module-implementation-roadmap.md:78`      |
| **Explicit sequencing prerequisite** | Row 11: "**Build before Page Workspace**" — Review & Approval Center backend + UI both live 2026-08-25 |
| Registry dependency                  | `["page_inventory"]` — live in production since 2026-08-23                                             |
| RBAC permission group                | `page_content`, already seeded (migration `00013`) — **no new RBAC migration**                         |
| Open Critical/High security finding  | None                                                                                                   |
| Blocking credential                  | None — this module needs no external integration                                                       |

**Unusually for this project, this module has real sourced spec material.** Every module since
Projects was built to "the smallest honest reading" of a flat field list. Several documents
describe this one:

- `03_Detailed_Module_Specifications.md §6` — the tab structure and the versioning/approval rules
- `05_Workflow_State_Machines.md §3` — a real 17-state page lifecycle plus 6 alternative states
- `05_Workflow_State_Machines.md §1/§2/§12` — general transition rules, the generic artifact
  lifecycle, and the required contents of every approval record
- `04_Data_Model_and_Ownership.md` — the "Pages and artifacts" table cluster, its unique
  constraints, and §5's explicit versioning rules
- `07_Low_Fidelity_Wireframes.md §3` — an actual approved wireframe
- `docs/design/dashboard-ui/15-representative-screen-specifications.md §7` — the approved
  design-system screen spec

Where this package makes a decision the sources do not state, it is flagged as such below.

## 1. Scope

**In scope (this pass):** `page_artifacts`, `page_artifact_versions`, the page lifecycle stage
machine, and the RBAC wiring for both.

**Deliberately out of scope (D1):** `page_relationships`, `page_component_usage`,
`page_deployments`. **No `dashboard-web` UI** — backend only, matching every prior module's own
backend-first precedent.

## 2. Design decisions

**D1 — Table scope: the core slice, not the full 5 remaining tables.** _(User-confirmed.)_
`04_Data_Model_and_Ownership.md`'s "Pages and artifacts" cluster names 7 tables; Page Inventory
already built `pages`/`page_urls` and explicitly deferred the rest to this module (its own D1).
Of the 5 remaining, `page_artifacts`/`page_artifact_versions` are this module's actual subject.
The other three are deferred because two of them would carry unvalidated foreign keys to modules
that do not exist: `page_component_usage` references Component Library (not built — Wave 3, itself
blocked behind `section_and_pattern_library`/`wireframe_library`), and `page_deployments`
references the Release Center (not built). `page_relationships` overlaps Internal Linking Library,
which is already live and owns page-to-page relationships today. Building any of the three now
would mean inventing placeholder columns nothing can validate.

**D2 — Per-artifact-type RBAC permission group, checked dynamically.** _(User-confirmed.)_ The
module registry seeds `page_workspace` to `page_content`, but the 15 artifact types span four
permission groups, and the seeded matrix (`00013-seed-rbac-matrix.ts`) makes gating everything on
`page_content` functionally wrong:

| Role                         | `page_content` | `creative_design` | `development_code` | `security_qa` |
| ---------------------------- | -------------- | ----------------- | ------------------ | ------------- |
| `developer`                  | `V`            | `V`               | **`VCES`**         | `VR`          |
| `designer_creative_reviewer` | `VR`           | **`VCERAS`**      | `V`                | `V`           |
| `qa_security_reviewer`       | `VR`           | `V`               | `VR`               | **`VCERAS`**  |

Gate the whole module on `page_content` and a developer can never edit the Implementation
artifact, a designer never the UI Specification, QA never the QA artifact — contradicting the
matrix's own evident intent. Instead each artifact type declares its own permission group,
resolved from a static map and checked via `AuthorizationService.assertAllowed()` inside the
service. This mirrors the layered pattern `ServicesService.changeApprovalStatus()` and
`ProjectApproversService.assign()` already established: a route-level `@RequirePermission` for the
baseline, plus the real per-payload action checked dynamically. **No new RBAC migration** — every
grant this uses is already seeded.

**D3 — 15 artifact types, not 16.** `03_Detailed_Module_Specifications.md §6` names 16 tabs, but
**History** is a derived read-only view over `page_artifact_versions` itself, not a versioned
artifact — an artifact whose content is "the version history" is incoherent. The other 15 are real
stored artifacts. Flagged rather than silently dropped.

| Artifact type        | Permission group  | Artifact type      | Permission group   |
| -------------------- | ----------------- | ------------------ | ------------------ |
| `overview`           | `page_content`    | `ui_specification` | `creative_design`  |
| `live_snapshot`      | `page_content`    | `component_map`    | `creative_design`  |
| `audit`              | `page_content`    | `implementation`   | `development_code` |
| `ideal_structure`    | `page_content`    | `code_review`      | `development_code` |
| `search`             | `page_content`    | `deployment`       | `development_code` |
| `content`            | `page_content`    | `security`         | `security_qa`      |
| `creative_direction` | `creative_design` | `qa`               | `security_qa`      |
| `ux_wireframe`       | `creative_design` |                    |                    |

**D4 — The page lifecycle gets a NEW `pages.lifecycle_stage` column.** _(User-confirmed.)_
`pages.workflowStage` is already taken: Page Inventory seeded it as the shared 8-value generic
artifact-approval vocabulary (its own D8, "a 5th occurrence of this identical shape"), and it is
live in production with a `changeWorkflowStage()` endpoint and a shipped UI. The 17-state page
lifecycle is a different axis entirely. Adding `lifecycle_stage` alongside it is purely additive —
no breaking change to a live module. The two axes are genuinely distinct: `workflowStage` governs
the page **record's** own approval; `lifecycle_stage` governs the page's **delivery progress**
through strategy, content, design, development, QA, and production.

**D5 — 22-value lifecycle, allowlisted, with no automatic progression.** From
`05_Workflow_State_Machines.md §3` verbatim: 16 main-path states (`proposed`,
`approved_for_planning`, `in_strategy`, `search_approved`, `content_approved`, `design_approved`,
`ready_for_development`, `in_development`, `code_review`, `security_qa`, `ready_for_staging`,
`staging_deployed`, `staging_approved`, `production_approved`, `production_deployed`, `verified`)
plus 6 alternative states (`revision_requested`, `blocked`, `paused`, `failed`, `rolled_back`,
`archived`) — 22 in total. Per the roadmap's own instruction, "**No automatic progression through
stages**": every transition is an explicit, separately permission-checked call. Nothing in this
module ever advances a stage as a side effect of another action.

**`pages.lifecycle_previous_stage`** (nullable) is added to make `paused`/`blocked` genuinely
resumable inside an allowlist: entering either stamps the stage departed from, and the only
transitions out are back to that stage or to `archived`. **Not sourced** — the spec names the
states but not how to leave them; this is the smallest mechanism that keeps every transition
allowlisted rather than requiring an open-ended "resume to anything" edge.

**D6 — Artifact-version status reuses the generic 8-value vocabulary.**
`05_Workflow_State_Machines.md §2`'s generic artifact lifecycle is exactly the vocabulary five
prior modules already use (`draft`, `submitted`, `under_review`, `approved`, `revision_requested`,
`rejected`, `superseded`, `archived`). Reused verbatim — a 6th occurrence of this identical shape,
deliberately not extracted into a shared helper, matching every prior module's own recorded
disposition on this exact point (already-accepted, out-of-scope debt).

**D7 — Approved versions are immutable; editing one forks a new draft version.** Directly sourced:
`04_Data_Model_and_Ownership.md §5` ("Approved artifacts are immutable. Editing an approved
artifact creates a new draft version.") and `03_Detailed_Module_Specifications.md §6` ("Approval
applies to an exact version. Reopening an approved stage creates a new version and records the
reason."). Implemented as: an `update()` against a version whose status is terminal is rejected; a
separate `reopen()` action creates version N+1 as a `draft`, copying content forward, marking
version N `superseded`, and recording `reopened_reason` plus `reopened_from_version_id`. A reason
is mandatory, per `05_Workflow_State_Machines.md §1` ("Rejection and revision require a reason").
This mirrors Website Strategy Center's own already-reviewed fork-on-edit-approved mechanism.

**D8 — No cross-module service call into Review & Approval Center.** The roadmap positions R&AC as
"the generic approval system for all future modules," and this module's artifact versions are
exactly the kind of target its polymorphic `target_module_key`/`target_id` design already accepts
— `AuthorizationService.isValidModuleKey("page_workspace")` returns true today, since the key is
in the seeded registry. But Page Workspace does **not** call `ReviewsService.create()`, because
the seeded grants make that impossible for the roles that need it: `review_center` gives `create`
only to `super_admin` and `owner_growth_approver`, while `marketing_editor` holds `submit` on
`page_content`. Routing submission through R&AC would 403 exactly the role the matrix intends to
let submit. So Page Workspace owns its artifact-version status transitions end-to-end, gated on
each artifact's own permission group (D2); a reviewer independently opens an R&AC review against
`page_workspace` plus the version id when a formal review record is wanted. No new coupling, no
permission mismatch, and no second approval authority. **Recorded as a real seam** — if the
`review_center` create grant is ever widened, integrating the two directly becomes worth
revisiting.

**D9 — Git-backed artifact provenance fields.** `04_Data_Model_and_Ownership.md §5` requires
Git-backed artifacts to record "repository, path, branch, commit SHA, and content checksum", and
§12 requires every approval to store the "Git commit SHA where applicable". All five are nullable
columns on `page_artifact_versions` — no GitHub integration adapter exists yet to populate them
automatically, so they are caller-supplied and unvalidated for now, the same deferred-integration
shape `pages.wordpressPageId` already uses.

**D10 — `content` and `notes` are rich text.** Per the 2026-08-22 standing rule, both go through
`RichTextEditor` on the frontend and real write-time sanitization
(`sanitizeRichTextHtml()`/`sanitizeNullableRichText()`, `@webdesk/validation`) — wired in this
backend pass so no follow-up conversion is needed when the UI is built.

**D11 — Project-scoped, inherited from `pages`.** `project_id` is denormalized onto both new
tables and set by the service layer from the parent page, never accepted from a caller — exactly
the mechanism `page_urls` already uses. Routes carry `:projectId` in the path so `PermissionGuard`
can resolve project-scoped grants (the gap Page Inventory's own code review caught and fixed), and
every resolved row's `projectId` is verified against the path value.

## 3. Schema (migration `00068`)

`page_artifacts` — one row per (page, artifact type): `id`, `page_id` (FK to `pages`, CASCADE),
`project_id` (FK to `projects`), `artifact_type` (ENUM, 15 values), `current_version_id`
(nullable), `created_by`, `updated_by`, timestamps. **`UNIQUE(page_id, artifact_type)`.**

`page_artifact_versions` — the versioned content: `id`, `artifact_id` (FK to `page_artifacts`,
CASCADE), `page_id`, `project_id`, `version_number`, `status` (ENUM, the 8-value vocabulary),
`content`, `notes`, `repository`, `path`, `branch`, `commit_sha`, `content_checksum`,
`reopened_reason`, `reopened_from_version_id`, `approved_by_user_id`, `approved_at`, `created_by`,
`updated_by`, timestamps. **`UNIQUE(artifact_id, version_number)`** — the data model's own
"artifact type + page + version" constraint exactly, since artifact identity already encodes page
plus type.

`pages` — two additive columns: `lifecycle_stage` (ENUM, 22 values, default `proposed`) and
`lifecycle_previous_stage` (same ENUM, nullable).

## 4. Acceptance criteria

- Every transition is allowlisted, backend-permission-checked, and audited (`§1`).
- No stage ever advances as a side effect of another action (roadmap row 12).
- An approved artifact version can never be mutated in place; reopening forks a new version and
  records a mandatory reason (`§6`, `§5`).
- Rejection and revision require a reason (`§1`).
- Every approval records entity plus exact version, approver, decision, and timestamp, with commit
  SHA where applicable (`§12`).
- A caller authorized on one project can never read or mutate another project's artifacts.
- Concurrent transitions cannot both succeed (atomic compare-and-swap, this codebase's established
  pattern).
- A role holding the relevant grant in its own permission group (developer on Implementation,
  designer on UI Specification, QA on QA) can genuinely edit that artifact (D2).
