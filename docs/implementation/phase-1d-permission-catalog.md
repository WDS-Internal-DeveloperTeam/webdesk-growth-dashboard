# Phase 1D (Expanded) — Permission Catalog

**Status:** Draft, produced during implementation of `docs/task-packages/phase-1d-rbac-permissions-expanded.md`.
Derives the permission catalog from approved sources, per that brief's own §5 requirement
("Do not create arbitrary permission names without documenting their source").

## 1. Action vocabulary — derived from `06_Roles_and_Permissions.md §2`

The only approved source that defines a permission-action vocabulary is
`06_Roles_and_Permissions.md §2`'s action legend:

| Letter | Action                  | Notes                                                            |
| ------ | ----------------------- | ---------------------------------------------------------------- |
| V      | `view`                  |                                                                  |
| C      | `create`                |                                                                  |
| E      | `edit`                  |                                                                  |
| S      | `submit`                |                                                                  |
| R      | `review`                |                                                                  |
| A      | `approve`               |                                                                  |
| P      | `publish` + `unpublish` | Expands to two actions — already implemented, migration `00013`. |
| L      | `release` + `rollback`  | Expands to two actions — already implemented, migration `00013`. |
| X      | `export`                |                                                                  |
| M      | `configure`             | "Manage configuration" per §2.                                   |

Plus two field-level actions from `06_Roles_and_Permissions.md §5` ("Field-level controls"):
`view_confidential`, `edit_confidential`.

This is the complete, approved action vocabulary: **12 grantable actions** (10 from the letter
legend's expansion, 2 field-level). No migration is needed to add `view_confidential`/
`edit_confidential` as grantable — `role_permissions.action` is already `STRING(32)`, not an
ENUM (migration `00011`'s own design choice), so these are new grant _rows_, not a schema change.

## 2. Actions deliberately NOT added, and why

`docs/task-packages/phase-1d-rbac-permissions-expanded.md §5`'s own illustrative example list
includes `Delete`, `Archive`, `Reject`, and `Execute` alongside the approved-vocabulary actions.
None of these four appear in `06_Roles_and_Permissions.md §2`'s action legend — the only document
that actually defines what a grantable action _is_. Per that brief's own instruction ("do not
create arbitrary permission names without documenting their source") and this project's
precedence model (an approved source outranks a task brief's own illustrative examples where they
conflict), none of the four are added as new first-class permission actions:

- **Reject** — `05_Workflow_State_Machines.md` does define "Rejected" as a real workflow outcome
  state (e.g. line 27, line 143), but it is a _decision outcome_ recorded on a workflow record, not
  a separately-grantable permission distinct from `review`/`approve`. Whoever holds `review` or
  `approve` on a module is the one who decides accept vs. reject — modeling "reject" as its own
  permission would let someone reject without being able to approve, a distinction no approved
  source draws. Rejection is implemented as a decision value on the review/approval action, not a
  new permission.
- **Archive** — `05_Workflow_State_Machines.md` mentions "Archived" as a terminal state (lines 20,
  62, 96, 118) but no approved source grants archiving as a distinct permission separate from
  `edit`/`unpublish`. Not added; archiving (once any workflow implements it) is gated by `edit` or
  `unpublish` on the owning module.
- **Delete** — no approved source defines a `delete` permission at all. Every real entity in
  `packages/database` uses Sequelize `paranoid` soft-delete already (an ORM-layer concept, not an
  authorization action) and the brief's own §5 already hedges this as "where explicitly allowed" —
  the weakest of its listed actions. Not added; if a future module needs real delete authorization,
  that is a new, separate, explicitly-sourced decision, not one this catalog fabricates.
- **Execute** — appears in the brief's own illustrative `tasks.execute` example (§5), but no
  business "tasks" module exists as code, and no approved source defines an `execute` permission.
  Not added for the same reason as the others.

## 3. Resource/module registry — two granularities, kept distinct

Two approved sources define "modules" at different granularities, and they are **not** a 1:1
mapping:

- `06_Roles_and_Permissions.md §3`'s high-level matrix has **21 rows** — the actual granularity the
  real, approved 458-grant permission matrix is defined against (already seeded, migration `00013`,
  table `modules`).
- `02_Version_1_Module_Inclusion_Matrix.md` lists **43 modules** — the real, fine-grained dashboard
  feature modules (e.g. "Case Study Library," "Portfolio Library," "Brand Library," "Design Token
  Library" are all separate rows there, but collapse into a single "Creative/design" or similar row
  in the 21-row matrix).

`docs/task-packages/phase-1d-rbac-permissions-expanded.md §12` asks for "a canonical module/resource
registry" compatible with all 43 modules, using "stable module IDs rather than display labels."
Given the approved permission _grants_ only exist at the 21-row granularity (there is no approved
458-row-times-two matrix at 43-module granularity — fabricating one would violate the "do not
create arbitrary permission names" instruction just as much as inventing new actions would), the
correct architecture is:

- Keep the existing `modules` table (21 rows, already seeded) as the **permission-granting**
  granularity — this is what `role_permissions` continues to reference, unchanged.
- Add a new `module_registry` table: the 43 real modules from `02_Version_1_Module_Inclusion_Matrix.md`,
  each with a stable `key` (e.g. `case_study_library`, `page_workspace`) and a `permission_group_id`
  foreign key pointing at which of the 21 `modules` rows actually gates access to it. This is a pure
  lookup/registry — it grants nothing on its own; `AuthorizationService.can()` for a 43-module
  resource resolves its `permission_group_id` and then evaluates the existing 21-row grant exactly
  as today.

This satisfies "compatible with all 43 approved dashboard modules" and "use stable module IDs"
without inventing any new grant data, and without churning the already-seeded, already-approved
`modules`/`role_permissions` tables. See `docs/implementation/phase-1d-role-permission-matrix.md`
for the full 43→21 mapping table.

## 4. Confidential-field permissions — deny-by-default, no blanket grants

`06_Roles_and_Permissions.md §3`'s "Confidential fields" row reads: Super Admin "Configurable",
Owner "Configurable", Marketing/Designer/Developer/Read-Only "Denied", QA/Security "Limited by
need". **"Configurable" is not "Yes"** — even Super Admin does not get a blanket
`view_confidential`/`edit_confidential` grant seeded by default. This phase implements the real
enforcement mechanism (the actions exist in the vocabulary, `AuthorizationService` checks them,
and the "Users/roles" admin surface can grant them per role going forward) but seeds **zero**
`view_confidential`/`edit_confidential` rows, consistent with migration `00013`'s own original
documented decision. Configuring them is a deliberate, later, explicit action — not automatic.

## 5. Permission identifier format

The brief's own §5 suggests a `<resource>.<action>` string format (e.g. `pages.edit`). This
codebase's existing, already-approved and already-shipped convention (migration `00011`,
`PermissionService`/`AuthorizationService`) is a `(moduleKey, action)` **pair**, not a single
dot-joined string — `can(userId, "page_content", "edit")`, not `can(userId, "page_content.edit")`.
Both encode the same information; changing the existing convention mid-phase would be pure churn
with no behavioral benefit, so the pair form is kept. `docs/implementation/phase-1d-rbac-architecture.md`
documents the `AuthorizationService` API surface using this form.
