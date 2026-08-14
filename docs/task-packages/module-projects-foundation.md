# Projects — task package

> Prepared per explicit instruction: "Prepare the Ready-for-Claude implementation task package
> for the Projects module... Do not implement the module yet... run consistency checks against the
> approved module roadmap/specification, and stop for human approval." This document does exactly
> that — it is a proposal for review, not an implementation. No code, migration, or config change
> has been made. Follows `docs/task-packages/templates/module-implementation-task-template.md`.

## 0. Pre-implementation verification (run before this package can be approved)

| Check                                   | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Roadmap wave / dependencies             | ✅ `docs/phase-plans/module-implementation-roadmap.md` §3 places `projects` in **Wave 1 — no dependencies** (24 modules with no prerequisite). `module_registry.dependencies` for `projects` is `null` (migration `00035`). Nothing blocks starting this module.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Real `module_registry` row              | ✅ Read directly from `00035-populate-module-registry-fields.ts:94-105`: `route: "/projects"`, `navigation_group: "projects"`, `navigation_order: 1`, `icon_reference: "briefcase"`, `confidentiality_level: null`, `dependencies: null`. Common defaults applied to every row: `view_permission_action: "view"`, `implementation_status: "not_started"`, `v1_inclusion_status: "included"`.                                                                                                                                                                                                                                                                                          |
| Permission group + real seeded grants   | ✅ `projects` → permission group **`project_configuration`** (`00015-seed-module-registry.ts:17`). Real grants (`00013-seed-rbac-matrix.ts:91-99`): `super_admin=VCEAM`, `owner_growth_approver=VEA`, all five other roles (`marketing_editor`, `designer_creative_reviewer`, `developer`, `qa_security_reviewer`, `read_only`) = `V` (view only). **No new RBAC seed migration is needed for V1 CRUD** — the grants already exist and already match the module spec's intent (only Super Admin / Owner-Growth-Approver can create/edit; everyone else views).                                                                                                                        |
| Module's real field/workflow spec       | ⚠️ Read in full. `03_Detailed_Module_Specifications.md` §2 (Projects) is real but **thin** compared to other modules — it gives primary records, actions, and one validation rule, but (unlike Home, Page Workspace, etc.) states no screens, no statuses, no explicit permissions table, no notifications, no audit events, and no acceptance criteria. §3 below records every place this package had to propose a value rather than quote one, and flags each explicitly.                                                                                                                                                                                                           |
| Integrations not yet built              | ✅ Confirmed and scoped out: `project_repositories` cannot be validated live — `docs/architecture/decisions/0011-github-app-authentication-and-webhooks.md` and `docs/contracts/github-integration-contract.md` both scope the GitHub App to exactly two known WebDesk-owned repos (the dashboard monorepo and, once created, the WordPress theme repo) and neither describes a mechanism for linking an arbitrary client repo. GitHub App private key/installation ID also aren't yet set as `dashboard-api` env vars (`docs/project-state/setup-input-register.md` line 11). §3 scopes `project_repositories` to reference/display metadata only, no live GitHub API calls, for V1. |
| Current gate state                      | ✅ `project.json.gates[]` — most recent gate is `G4-1F`, `status: "passed"`, `decision: "CONFIRM"`, 2026-08-14. Notes explicitly confirm `module_registry.implementation_status = 'not_started'` for all 43 modules at that gate — Projects would be the **first real business module** built on this foundation.                                                                                                                                                                                                                                                                                                                                                                     |
| No open Critical/High security finding  | ✅ (with a caveat worth recording honestly) — this project's `docs/security/` documents don't use a Critical/High severity taxonomy at all; they use STRIDE tables with "accepted gap" / "residual risk" narrative language, and every existing threat model self-assesses its open items as non-critical given no production users yet. No open item in any existing threat model names Projects, RBAC's `project_configuration` group, or `user_roles.project_id`.                                                                                                                                                                                                                  |
| No missing production secret/credential | ⚠️ One real blocker for a _sub-feature_, not the module as a whole: GitHub App private key/installation ID aren't set as `dashboard-api` env vars yet. This only matters if `project_repositories` needed live GitHub calls — since §3 scopes that out for V1, it does not block this package.                                                                                                                                                                                                                                                                                                                                                                                        |

**Result: no blocking gap found for a V1-scoped Projects module.** Several spec silences exist (see
§3/§4) — none is a dependency blocker, but several need an explicit human decision before or during
implementation, flagged throughout rather than resolved unilaterally.

## 1. Authorization

**Authorized by:** explicit user instruction, this session: "Prepare the Ready-for-Claude
implementation task package for the Projects module... Do not implement the module yet... Once
that task package looks correct, you authorize Projects only for implementation." **This
authorizes preparing this document only.** Per that same instruction, implementation does not begin
automatically when this document is finished — it begins once a human confirms this package "looks
correct," matching every prior phase's separate-authorization discipline in this project.

**Scope:** a single module — `projects` (Wave 1, no co-dependent group).

## 2. Branch

Off `main` at commit `5722deb7508f9affc655f04661c3b5e169eb3a50` (HEAD as of this package's
preparation — the commit recording the Phase 1E/1F production-migration gap closure). Proposed
branch name: `module-projects-foundation`.

## 3. Scope

### What "project" means here (disambiguation — read before anything else)

This codebase already overloads the word "project" three ways: (1) `project.json` — this
_delivery engagement's own_ state file, unrelated to this module; (2) `user_roles.project_id` /
`role_permissions` — a schema-ready authorization scoping slot built in Phase 1D-expanded with no
real table behind it yet; (3) the **client engagement** this module models — a specific WebDesk
Solution client website/growth engagement (e.g., a particular customer's site work), which is what
`03_Detailed_Module_Specifications.md` §2 and `04_Data_Model_and_Ownership.md`'s "Projects and
configuration" entity group both mean by "project." This package is about sense (3) only, and its
new `projects` table is what sense (2)'s `project_id` columns will finally reference.

### In scope

- A real `projects` table and the record types `03_Detailed_Module_Specifications.md` §2 names as
  primary records — **project**, **objectives**, **phases/roadmap**, **project team**,
  **environments**, **repositories** — mapped onto concrete tables in §5 below.
- The six named actions: create/update project, assign users, define approvers, set active phase,
  pause project, archive project — each as a real, permission-checked, audited API operation (§7).
- Wiring `user_roles.project_id` (Phase 1D-expanded, schema-only until now) to a real FK against
  this module's `projects.id` — the first real exercise of that mechanism.
- A project list screen and a project detail screen in `dashboard-web`, built from the existing
  application shell and `packages/ui` components (Phase 1F) — proposed screens only, see the
  "UI surface — not sourced" callout in §4/§8.
- New `AuditEventType` vocabulary entries for project-specific events (§13).
- Retention-category assignment for `projects` rows via the existing Phase 1E retention mechanism
  — using an existing approved category if one fits, otherwise flagged as its own open item (§4,
  design decision D6).

### Explicitly out of scope

- **Live GitHub validation of `project_repositories`.** No approved doc describes how a client
  project's repo would connect to the GitHub App's actual installation scope (confirmed absent
  from ADR-0011, `github-integration-contract.md`, and `database-contract.md` — all three were
  checked directly). V1 stores repo metadata (owner/name/default branch/notes) for reference and
  display only — no webhook wiring, no live API calls, no validation that the App can actually see
  the repo. Building that is a separate, later authorization once the GitHub integration contract
  itself is extended to cover per-project repos.
- **Wiring the shell's "Project Switcher"** (`07_Low_Fidelity_Wireframes.md` §1) to real project
  data, beyond the minimum needed to prove the list endpoint works. Phase 1F's brief §11 scoped a
  "minimal project-context foundation" as in-shell-scope "if required for shell operation," but no
  evidence was found that it was actually built (no reference in
  `docs/project-state/phase-1f-validation-report.md`). Fully wiring the switcher, and any
  session-level "current project" concept downstream modules will read, is real UI/UX scope this
  package does not claim to have designed — flagged as design decision D7, not silently assumed.
- **`operational_areas`/`operational_contacts`.** `04_Data_Model_and_Ownership.md` lists
  `operational_contacts` under "Projects and configuration" (line 39), but the table of that exact
  name **already exists**, built in Phase 1E (`00027-create-operational-contacts.ts`) — and it is a
  **global, system-wide** incident-escalation contact list (`area` is a free string like
  `"dashboard"`/`"wordpress"`/`"devops"`/`"security"`, no `project_id` column at all), matching
  `09_Security_Backup_Retention_Operations.md` §8's fixed "configurable operational areas" list
  (which includes "Project Management" as one _area_, not a client project) and the "Users and
  Operational Contacts" wireframe (`07_...` §11, under Settings, not Projects). **This package does
  not touch, extend, or reinterpret that table.** If the canonical data-model doc's intent really
  was a _per-project_ contact list distinct from Phase 1E's global one, that is a naming collision
  in the source documents needing its own resolution — flagged for human decision, not resolved
  here (design decision D1).
- **Business Knowledge Center, or any other module.** Per the user's explicit rule 14 and rule 13:
  this package touches only `projects` and the pre-existing, already-approved
  `user_roles.project_id` FK slot. No other module's code, schema, or registry row changes.
- **Import/export.** Nothing in the Projects spec names an import/export requirement, and a
  dedicated `import_and_export_center` module already exists in the registry (its own Wave 1 item)
  as the intended generic framework for this. Projects may become an import/export _target_ of
  that module later — that's its authorization, not this one's.
- **Real notification delivery.** Phase 1E's `NotificationService` exists but is deliberately inert
  (`UnconfiguredNotificationDeliveryAdapter`, no real SMTP configured). See §14 — creating
  notification _records_ is proposed as optional V1 scope; real delivery is out of scope regardless
  until SMTP is separately wired.
- **Background jobs.** No bulk/scheduled operation is named anywhere in the Projects spec. See §15.
- **Multi-tenancy of any kind.** Per the user's rules 2/3 and this project's already-recorded
  `project.json.tenant.mode = "per-client"`: every `projects` row belongs to the single WebDesk
  Solution tenant this dashboard instance serves. `webdesksolution.com` and `webdeskinc.com` users
  are the same tenant's users, never separate customer accounts. This module does not add any
  cross-tenant or customer-account concept.

## 4. Design decisions

Numbered so §0's flagged spec silences each get one explicit, traceable proposed resolution. None
of these is presented as already-approved — each needs the human reviewer's confirmation or
correction before implementation starts.

**D1 — `operational_contacts` naming collision: do not touch it.** The canonical data-model doc
groups `operational_contacts` under Projects; the real, already-built table of that name is global
and unrelated. Proposed resolution: treat this as a documentation artifact of the source spec, not
a build instruction — this package builds no per-project contact table. If a genuine need for
"who's the point of contact for _this specific client project_" later emerges, it should get its
own distinctly-named table (e.g. `project_contacts`) and its own authorization, never overload the
existing global `operational_contacts`.

**D2 — Project status: propose a 3-value controlled enum.** `05_Workflow_State_Machines.md` defines
no Project state machine, despite "pause project"/"archive project" being named actions. Proposed:
`status ENUM('active', 'paused', 'archived')`, default `active` on create. Valid transitions:
`active ↔ paused` (either direction), `active|paused → archived` (terminal — matches rule 7/8:
archival, not deletion, and once archived a project isn't casually reactivated). Enforced
server-side in a transition method, not a raw field PATCH (§7). This is this implementer's own
reasoned proposal, following the exact same "not sourced, flagged as such" discipline Phase 1F's
own migration `00035` used for its nav-grouping assignment — not an invented-but-unstated fact.

**D3 — "Phases"/"roadmap" map to one entity, `roadmap_items`.** The module spec's prose names
"phases" and "roadmap" separately, but `04_Data_Model_and_Ownership.md`'s actual entity list names
only `roadmap_items` (no separate `phases` table) — read directly, line 37. Proposed: one
`roadmap_items` table represents both; "phase" is simply what a `roadmap_items` row is called in
the UI. "Set active phase" = `projects.active_phase_id` (nullable FK into `roadmap_items`), with a
partial unique index enforcing at most one `active` row per project at the database layer — the
same "enforce the real invariant at the DB layer, not just in application code" discipline
`ADR-0017`'s audit-immutability trigger already established for this project.

**D4 — Project team vs. project-scoped authorization: don't duplicate them.** The canonical entity
list names both `project_users` (line 35) and implies project-scoped authorization exists
separately (`04_...` line 189's `project_role_assignments`, never actually described in
`06_Roles_and_Permissions.md`). Proposed split, matching the user's own rule 4 ("Users may have
project-scoped authorization as already supported by RBAC"): **`project_users` is a lightweight
roster** (who's associated with this project, for display/notification targeting) — it grants no
authorization by itself. **Actual project-scoped authorization continues to use the existing,
already-built `user_roles.project_id` mechanism** (Phase 1D-expanded), now finally given a real FK
target. "Assign users" writes to `project_users`; "define approvers" assigns the existing
`owner_growth_approver` role scoped to this project via the existing role-assignment endpoints
(Phase 1D/1D-expanded) with a real `project_id` — no new authorization table, no new role invented.
This also resolves the never-described `project_role_assignments` name: it doesn't need to exist as
its own table, because `user_roles.project_id` already is that mechanism.

**D5 — `project_repositories`: metadata only, one FK constraint added to existing schema.** Per the
out-of-scope note above. Fields: `provider` (fixed `'github'` for V1), `repo_owner`, `repo_name`,
`default_branch`, `notes` — no credentials, no tokens, no webhook secrets (rule 10). This package
also adds the FK `user_roles.project_id → projects.id` (currently unconstrained per migration
`00016`'s own doc comment, since no `projects` table existed) — a genuinely new, small migration on
top of Phase 1D-expanded's existing column, not a new authorization concept.

**D6 — Retention category: flagged, not invented.** `09_Security_Backup_Retention_Operations.md`'s
retention matrix (§6) names no category for project records specifically — only generic
"Soft-deleted records — 30 days" and audit-trail rows, which cover different things (a deleted row,
and the audit log itself) than an _active_ project record's own retention. Proposed: **do not
invent a new retention category inside this package.** Either (a) the human reviewer confirms an
existing approved category applies (e.g., treat active project rows as indefinite/operational,
only the 30-day soft-delete rule applying once archived+deleted), or (b) a new category is
proposed and approved the same way Phase 1E's 25 categories were — as its own small, explicit
review, not silently added as row 26 by this package. `projects.retention_category` is nullable at
migration time either way; a null value is honest until this is resolved, not a placeholder pretending
to be real.

**D7 — Project Switcher wiring: explicitly out of scope, flagged as the next real gap.** This
package makes `GET /projects` real for the first time, which the shell's Project Switcher would
need — but actually wiring that UI element, and any session/request-level "current project"
concept other modules will eventually read, is real design/engineering work with no sourced spec
(see the out-of-scope note above). Recommend a small, focused follow-up authorization once this
package is approved, rather than silently bundling undesigned shell UX into a data-model package.

**D8 — Confidential fields: recommend none for V1.** The registry row's `confidentiality_level` is
`null`, and no document names a specific Projects field as confidential. `view_confidential`/
`edit_confidential` currently have **zero seeded grants for any module** (confirmed directly against
`00013-seed-rbac-matrix.ts`'s full matrix) — wiring them here would mean every field marked
confidential is permanently unreadable to everyone, including Super Admin, until a separate
authorization seeds real grants. Recommend V1 ships with no field-level confidential gating; if the
human reviewer wants specific fields (e.g., environment URLs, repository details) treated as
confidential, that requires (1) naming the exact fields and (2) a separate, explicit grant-seeding
migration — both flagged here as needed, not assumed.

## 5. Data model

New tables (all under `packages/database`, migrations `00036` onward — next after the currently
latest, `00035`), following the base entity standard (`04_Data_Model_and_Ownership.md` §1: `id`
UUID PK, `public_id`, `version`, `status`, `owner_user_id`, `created_at`/`created_by`,
`updated_at`/`updated_by`, `lock_version`, `deleted_at`/`deleted_by`, `retention_category`,
`confidentiality`, `audit_context_id`) wherever the spec doesn't call for something narrower:

- **`projects`** — `id`, `public_id` (stable, human-readable — rule 5: never regenerated once
  assigned), `name`, `description` (nullable), `status` (`active`/`paused`/`archived`, D2),
  `active_phase_id` (nullable FK → `roadmap_items.id`, D3), `owner_user_id`, plus the full base
  standard set. **No columns store secret values** (rule 10) — repository/environment credentials
  are never modeled here, only metadata (D5).
- **`project_environments`** — `id`, `project_id` (FK), `name` (free text — "the dashboard's own
  Development/Preview/Staging/Production tiers" per `01_Dashboard_Master_Specification.md` §7 is a
  _different_ concept from a client project's own environment list, which no document defines a
  closed vocabulary for), `url` (nullable), `notes` (nullable), base standard subset
  (created/updated/deleted).
- **`project_repositories`** — per D5: `id`, `project_id` (FK), `provider` (fixed `'github'` V1),
  `repo_owner`, `repo_name`, `default_branch`, `notes`, base standard subset.
- **`project_users`** — the roster, per D4: `id`, `project_id` (FK), `user_id` (FK → `users`),
  `added_at`, `added_by`. No `role` column here — authorization role lives in `user_roles`.
- **`project_objectives`** — `id`, `project_id` (FK), `description`, `status` (nullable/simple —
  the spec gives no detail beyond naming "objectives" as a primary record), base standard subset.
- **`roadmap_items`** ("phases"/"roadmap", D3) — `id`, `project_id` (FK), `name`, `sequence`
  (integer, ordering), `status` (`not_started`/`active`/`complete`/`skipped` — proposed, not
  sourced), base standard subset. Partial unique index: at most one `status = 'active'` row per
  `project_id`.

**Relationships:** `projects` 1—N each of `project_environments`, `project_repositories`,
`project_users`, `project_objectives`, `roadmap_items`; `projects.active_phase_id` 1—0/1 →
`roadmap_items`; and, newly, `user_roles.project_id` → `projects.id` (FK added by this package,
D5) — the first real target for that Phase 1D-expanded column.

**Indexes:** directly per `04_Data_Model_and_Ownership.md` line 41 — _"Key indexes: project status,
environment, repository name, roadmap phase/status."_ — i.e., `projects(status)`,
`project_environments(project_id, name)`, `project_repositories(project_id, repo_name)`,
`roadmap_items(project_id, status)`.

## 6. Permissions

- **View/Create/Edit/Approve/Manage-config:** already-seeded, no new grants needed. Permission
  group `project_configuration` (00015:17); real grants (00013:91-99): `super_admin = VCEAM`,
  `owner_growth_approver = VEA`, all five other roles = `V` only.
- **Action permissions used:** `view`, `create`, `edit`, `approve` — all already map to real letters
  in the existing grant matrix. No new action beyond plain `view`/`create`/`edit`/`approve` is
  introduced, so nothing here needs the "central authorization catalog change" process.
- **Confidential fields:** none for V1 — see D8.
- **Project-scoped authorization:** `user_roles.project_id` set to the real `projects.id` (D4) —
  the first production use of a mechanism that's existed, tested only against arbitrary UUIDs,
  since Phase 1D-expanded.
- **Production release authority:** no document names a role distinct from `owner_growth_approver`
  for this. Proposed: "define approvers" assigns `owner_growth_approver`, scoped to the project via
  `user_roles.project_id` — reusing the existing role rather than inventing a new one, per ADR-0010's
  requirement that every action's authorized role(s) be declared explicitly before implementation.

## 7. API surface

All routes under `SessionGuard` (class-level) + `PermissionGuard` + `@RequirePermission("project_configuration", "<action>")`
per route, `OriginCheckGuard` preceding `PermissionGuard` on every mutating route — the exact
pattern `OperationalContactsController` already establishes. Every response uses the standard
`ApiSuccessResponse<T>` envelope (`{ success: true, data, correlationId }`) from
`packages/shared-types`.

| Method                | Path                          | Action        | Notes                                                                                                                       |
| --------------------- | ----------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------- |
| GET                   | `/projects`                   | `view`        | Paginated; filter by `status`; search `name` (ILIKE); sort by `name`/`status`/`updated_at`.                                 |
| POST                  | `/projects`                   | `create`      | Creates in `status: 'active'`.                                                                                              |
| GET                   | `/projects/:id`               | `view`        | Includes environments/repositories/team/roadmap summaries.                                                                  |
| PATCH                 | `/projects/:id`               | `edit`        | Name/description only — not `status` (see next row).                                                                        |
| POST                  | `/projects/:id/status`        | `edit`        | Controlled transition per D2's state machine — rejects invalid transitions, not a raw field write.                          |
| POST                  | `/projects/:id/active-phase`  | `edit`        | Sets `active_phase_id`; DB partial-unique index backs the invariant.                                                        |
| GET/POST/DELETE       | `/projects/:id/users`         | `view`/`edit` | Roster (D4) — not authorization by itself.                                                                                  |
| GET/POST/PATCH/DELETE | `/projects/:id/environments`  | `view`/`edit` | Metadata only, no credentials.                                                                                              |
| GET/POST/PATCH/DELETE | `/projects/:id/repositories`  | `view`/`edit` | Metadata only, no live GitHub calls (out of scope).                                                                         |
| GET/POST/PATCH/DELETE | `/projects/:id/objectives`    | `view`/`edit` |                                                                                                                             |
| GET/POST/PATCH/DELETE | `/projects/:id/roadmap-items` | `view`/`edit` |                                                                                                                             |
| POST                  | `/projects/:id/approvers`     | `approve`     | Assigns `owner_growth_approver` role scoped to this project via the existing role-assignment endpoint, not a new mechanism. |

## 8. UI surface

**No approved wireframe exists for Projects** (`07_Low_Fidelity_Wireframes.md` only shows the shell
nav item and header "Project Switcher" — confirmed by direct read, no dedicated section). The
screens below are this implementer's own reasoned proposal, following the general shell/tabbed
detail-screen conventions the wireframe doc _does_ establish elsewhere (e.g. Page Workspace's
header/tabs/action-bar shape), built from `packages/ui`'s existing page-shell and UI-state
components (Phase 1F) — not sourced, and should be confirmed or corrected by the human reviewer,
ideally with a real design pass, before or during implementation:

- **Project List** (`/projects`) — table: name, status (badge), active phase, owner, updated at;
  search box; status filter; column sort.
- **Project Detail** (`/projects/:id`) — header (name, status, owner, actions: pause/archive/edit);
  tabs: Overview, Team, Environments, Repositories, Roadmap.
- **Create/Edit Project** — form (name, description); status/archival handled via the dedicated
  transition action, not this form.

## 9. Search / filter / sorting

Name search (`ILIKE`), status filter, sort by `name`/`status`/`updated_at`/`created_at` — see §7's
`GET /projects`. Nothing more specific is named in the spec; kept intentionally minimal rather than
invented.

## 10. Statuses

`projects.status`: `active` (default) ↔ `paused`; either → `archived` (terminal). See D2.
`roadmap_items.status`: `not_started`/`active`/`complete`/`skipped`, at most one `active` per
project (DB-enforced). Both proposed, not sourced — see D2/D3.

## 11. Project-context rules

- Rule 1 (Projects establish canonical project context): this package makes `GET /projects` and a
  real `projects.id` exist for the first time — the actual consumption of that context by the shell
  (Project Switcher) and other modules is explicitly deferred, D7.
- Rule 4 (project-scoped RBAC): implemented via existing `user_roles.project_id`, not a new
  mechanism — D4.
- Rule 5 (stable IDs): `id` (UUID, internal FK target, never changes) and `public_id`
  (human-readable, also never regenerated once assigned) are both immutable once created.

## 12. Confidential fields

None for V1 — D8. `confidentiality_level` stays `null` on the `projects` module-registry row unless
the human reviewer names specific fields and separately authorizes seeding real
`view_confidential`/`edit_confidential` grants.

## 13. Audit events

Per rule 11 ("emit Phase 1E audit events for controlled changes") — extend the closed
`AuditEventType` union (`packages/database/src/audit/entities.ts`) **and** its runtime mirror
(`AUDIT_EVENT_TYPES`/`AUDIT_EVENT_CATEGORIES` in `apps/dashboard-api/src/audit/audit.service.ts` —
both files must change together or `AuditService.record()` throws). Proposed new literal:
`project_status_changed` (status transitions are significant/retention-relevant enough to warrant
their own type, matching the specificity of existing `publish`/`unpublish`/`release`/`rollback`
types rather than being folded into the generic type). Ordinary create/update/team/environment/
repository/roadmap changes reuse the existing generic `data_change` type with
`entityType: "project"` (or the relevant sub-entity) — no new type needed for those. Approver
assignment reuses the existing `permission_change` type (it's already a role assignment through the
existing mechanism, D4) — not a new Projects-specific type.

## 14. Notifications

Not in V1 by default — nothing in the module spec requires it, and Phase 1E's delivery adapter is
deliberately inert (no real SMTP). Optional, cheap to add alongside the audit-event call sites if
the human reviewer wants notification _records_ created (not delivered) for user-assigned/
status-changed events — flagged as a take-it-or-leave-it addition, not assumed in scope.

## 15. Job requirements

None identified. No bulk or scheduled operation is named anywhere in the Projects spec. (If bulk
CSV import of projects is wanted later, that depends on both the separate Import and Export Center
module and Task 9's still-unbuilt real background-worker/queue wiring — noted, not started here.)

## 16. Import/export requirements

Out of scope — see §3. Defer to the `import_and_export_center` module.

## 17. Validation

Server-side DTOs (`class-validator`, matching established `dashboard-api` convention): `name`
required; `status` transition validated against D2's allowed-transition set (rejected, not
silently coerced, on an invalid request); `active_phase_id` must reference a `roadmap_items` row
belonging to the same `project_id`; `project_repositories.repo_owner`/`repo_name` format-checked
(not existence-checked — no live GitHub call, §3); the module's own stated validation rule
("production release authority and confidential-field access must be explicit") is satisfied by
D4/D8's design — approver assignment is always an explicit action, never implied by another write.

## 18. Security

Standard guard stack (§7); no secrets in any Projects table (rule 10, enforced by field design —
credentials are never modeled, not merely "not filled in"); CSRF via the existing `OriginCheckGuard`
pattern on every mutating route; server-side authorization only, no client-side-only permission
check treated as sufficient (ADR-0010).

## 19. Accessibility

New `dashboard-web` routes must pass the existing automated WCAG 2.2 AA check (axe-core, Phase 1F
CI foundation) with zero violations, same bar as every existing shell page.

## 20. Performance

List endpoint paginated (never an unbounded `SELECT *`); indexes per §5's exact `04_...` line-41
citation. No N+1 risk expected at V1 scale (a handful of client projects, not thousands) but the
repository layer should still use eager-loaded associations for the detail endpoint's
environments/repositories/team/roadmap summary, not per-row queries.

## 21. Testing

- [ ] Unit tests for new services (`ProjectService`, phase-transition logic, D2/D3 invariants)
- [ ] Real-database integration tests for new repositories/migrations, including the
      `roadmap_items` partial-unique-index invariant and the new `user_roles.project_id` FK
- [ ] e2e/controller tests for every endpoint in §7, including at least one permission-denied case
      per action (a `read_only`-role user attempting `create`/`edit`/`approve`)
- [ ] Playwright coverage for the new List/Detail/Create screens, including an axe-core pass

## 22. Migration requirements

New migrations `00036` onward (next after the current latest, `00035`) in `packages/database`:
create `projects`, `project_environments`, `project_repositories`, `project_users`,
`project_objectives`, `roadmap_items`; add the FK `user_roles.project_id → projects.id` (safe —
zero existing rows use a real `project_id` today, confirmed via the technical-conventions research
this package is based on, so no backfill risk). Migration up/down round-trip tested on a fresh
disposable database before any gate is requested. **Not run against the real production database
by this package** — that remains the same separate "user runs it themselves" step as every prior
phase's production migration.

## 23. Documentation deliverables

- [ ] `docs/implementation/module-projects-foundation.md` — as-built record
- [ ] Validation report (same shape as every prior phase/slice)
- [ ] `docs/traceability/phase-0-requirements-traceability.md` update, if this closes a
      traceability item
- [ ] `outputs/webdesk-growth-dashboard/HANDOFF.md` update
- [ ] `module_registry.implementation_status` for `projects` updated to a real, honest value —
      never left at `not_started` once real functionality exists, never advanced past what's
      actually true for the scope actually built (V1 as defined in §3, not the full spec's every
      possible future field)

## 24. Approval gates

This document itself is the first gate: it needs explicit human confirmation ("this package looks
correct") before implementation begins, per the authorizing instruction. After that, the same
discipline every prior phase followed applies in full: build → full validation suite → independent
code review → a right-sized security review (this is the **first real business entity and the
first real use of project-scoped RBAC** in production code, which argues for a real, not
minimal, security pass, given it directly touches ADR-0010's separation-of-duties model) →
required second-role **human** review (never the implementing agent) → a separate gate decision →
a separate merge authorization. None of these steps is implied by an earlier one.

## 25. Rollback / recovery

Migration down-scripts tested alongside up-scripts, including a clean drop of the new
`user_roles.project_id` FK. Soft-delete architecture (base standard's `deleted_at`/`deleted_by`)
means ordinary deletion is always reversible at the row level. Rule 7/8 compliance: there is no
cascade-delete path from a `projects` row to any website/business-record table in this package (no
such tables are touched at all) — archival (D2) is the only "removal" verb this package implements;
hard deletion of a project, if ever wanted, is explicitly out of scope pending its own retention/
legal-hold-aware design (D6).

## 26. Forbidden actions

Directly enumerating the user's 14 special rules as binding constraints on implementation, plus the
project's standing rules:

1. No customer/account multi-tenancy of any kind (rules 2/3).
2. No new confidential-field grants seeded without a separate, explicit authorization (D8, rule
   per the standing "no module may invent authorization outside the central catalog" rule).
3. No cascading deletion from `projects` into any website/business-record table (rule 7).
4. No hard deletion — archive/soft-delete only, per approved retention rules once D6 is resolved
   (rule 8).
5. No secret values (credentials, tokens, passwords) stored in any `projects`-family table (rule 10) — enforced by field design, not merely by convention.
6. No self-invented authorization mechanism — project-scoped access goes through the existing
   `user_roles.project_id`/`AuthorizationService` only (rule 12, D4).
7. No modification of any other module's code, schema, or registry row (rule 13).
8. No automatic start of Business Knowledge Center or any other module's work (rule 14).
9. No client-side-only permission check treated as sufficient (ADR-0010, standing rule).
10. No direct database access from `dashboard-web` (ADR-0002, standing rule).
11. No merge without a separate, explicit authorization; no auto-deploy; no starting the next
    module/wave automatically (ADR-0018, standing rule — same as every prior phase's task package).
12. No production migration run by this package or its implementation phase without the same
    separate "user runs it themselves" authorization as every prior phase.

## 27. Exact completion evidence

Implementation of this package is complete only when **all** of the following are true and
recorded, not asserted:

- [ ] Fresh disposable-database migration up/down round-trip — actual command output recorded
- [ ] `pnpm typecheck` / `pnpm lint` / `pnpm format` clean across every touched package
- [ ] Full unit + integration + e2e suite passing — the whole monorepo, not just this module's own
      tests, with exact pass counts recorded (matching every prior phase's validation-report style)
- [ ] At least one permission-denied e2e test per §7 endpoint, passing
- [ ] Playwright + axe-core pass for the new List/Detail/Create screens, zero violations
- [ ] `pnpm audit` clean, or any new finding explicitly triaged
- [ ] Module-registry and permission-mapping validation still passes
      (`pnpm --filter @webdesk/database validate:module-registry`)
- [ ] `module_registry.implementation_status` for `projects` updated to reflect real, current,
      honest status
- [ ] Independent code review run and findings dispositioned (fixed or explicitly tracked as debt)
- [ ] Security review completed (right-sized per §24) and findings dispositioned
- [ ] All §23 documentation deliverables produced
- [ ] Required second-role human review completed, decision recorded
- [ ] Gate decision requested and recorded in `project.json.gates[]`
- [ ] Branch pushed, PR opened — **not merged, not deployed, without a separate, explicit,
      later authorization**

## 28. Open items requiring human decision before or during implementation

Consolidated from §4 — nothing below blocks _this document_ from being reviewed, but each should be
confirmed, corrected, or explicitly deferred before implementation is authorized to proceed past
the point each one matters:

1. D1 — the `operational_contacts` naming collision in the source docs (informational; no action
   needed unless a real per-project contact need emerges later).
2. D2/D3 — the proposed status enum and phase/roadmap modeling (not sourced from any approved
   doc — confirm or correct).
3. D6 — the retention category for `projects` rows (confirm an existing category applies, or
   authorize a new one).
4. D7 — Project Switcher / shell project-context wiring (explicitly deferred; confirm that's
   acceptable for V1, or fold it into this authorization).
5. D8 — whether any Projects field should actually be confidential-gated (default: no for V1).
6. §8 — the proposed UI screens have no approved wireframe behind them; confirm, correct, or
   commission a real design pass.
