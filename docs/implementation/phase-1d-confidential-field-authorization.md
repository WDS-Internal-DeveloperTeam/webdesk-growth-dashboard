# Phase 1D (Expanded) — Confidential-Field Authorization

**Status:** Draft, produced during implementation of
`docs/task-packages/phase-1d-rbac-permissions-expanded.md` §11.

## 1. Source requirement

`06_Roles_and_Permissions.md §5` ("Field-level controls") — the API must independently enforce:
view confidential field; edit confidential field; export confidential field; send confidential
field to a Claude task package; include confidential field in a Git artifact. Default is denied.
`06_Roles_and_Permissions.md §3`'s own matrix row for "Confidential fields": Super Admin
"Configurable", Owner "Configurable", Marketing/Designer/Developer/Read-Only "Denied",
QA/Security "Limited by need" — **"Configurable" is not "Yes."**

## 2. What is implemented this phase

Two grantable actions, `view_confidential` and `edit_confidential`, added to the permission
vocabulary (`docs/implementation/phase-1d-permission-catalog.md §1`). No schema migration was
needed to add them — `role_permissions.action` is `STRING(32)`, not an enum (migration `00011`'s
own design), so these are new grant rows, not a new column.

`AuthorizationService.canViewConfidential(userId, moduleKey, projectId?)` and
`.canEditConfidential(userId, moduleKey, projectId?)` check these actions specifically — thin
wrappers around the same `evaluate()` path every other check uses, so confidential-field checks
get the same deny-by-default, disabled-user, unknown-module, and no-roles handling as every other
authorization decision, not a parallel code path.

**Zero `view_confidential`/`edit_confidential` grant rows are seeded for any role**, consistent
with migration `00013`'s original decision and the source matrix's "Configurable" (a capability
that _can_ be turned on per role, not one that already is). Even Super Admin does not get a
blanket confidential-field grant by default — configuring one is a deliberate, later, explicit
action via the "Users/roles" admin surface (`RoleAssignmentController`'s existing role-assignment
mechanism grants roles; granting a specific `(role, module, view_confidential)` permission row is
the same `role_permissions` table but has no dedicated write endpoint yet in this phase — the
seeded read path is what this phase proves).

`redactConfidentialFields`/`redactConfidentialFieldsFromList`
(`apps/dashboard-api/src/authz/confidential-field.util.ts`) are pure, entity-agnostic functions: given a record and a
list of field names considered confidential, strip those fields unless the caller is
authorized. They take no dependency on any specific business entity — a future module with real
confidential fields imports and calls them, rather than each module reinventing redaction. Tested
(`confidential-field.util.spec.ts`, 6 tests) against an explicitly-labeled illustrative-only
`SampleCaseStudyRecord` fixture — not a real business entity, since none is authorized to exist in
this phase.

## 3. What is explicitly not implemented this phase, and why

- **Export/Claude-task-package/Git-artifact confidential-field enforcement** — §5 lists these as
  additional confidential-field enforcement points beyond view/edit. No export pipeline, Claude
  task-package generator, or Git-artifact writer exists as code yet (task package §32 excludes
  import/export and Ready for Claude Queue business logic from this phase). `view_confidential`/
  `edit_confidential` are the two actions with a real enforcement point
  (`AuthorizationService`) today; the others are future call sites for the same
  `canViewConfidential`/redaction utilities once those pipelines exist, not additional actions to
  invent now.
- **A dedicated grant-editing endpoint** for `view_confidential`/`edit_confidential` specifically
  — the existing "Users/roles" HTTP surface (`RoleAssignmentController`) assigns/revokes whole
  roles, not individual `(role, module, action)` grants. Building fine-grained grant editing was
  not requested by this phase's endpoint list (task package §20) and doing so now would be scope
  the user has not authorized.
- **Any real confidential business field** — no business entity exists in this phase (deliberate,
  per `CLAUDE.md`'s standing caution). The redaction utility and the two grantable actions are the
  complete, real enforcement mechanism a future module plugs into.

## 4. Verification

- Unit: `authorization.service.spec.ts`'s "canViewConfidential / canEditConfidential" suite —
  confirms both check the `view_confidential`/`edit_confidential` actions specifically, not a
  generic `view`/`edit`.
- Unit: `confidential-field.util.spec.ts` — redaction correctness against the illustrative fixture.
- Real-database: `packages/database/test/phase1d-authz.integration.test.ts`'s "no confidential-field
  grant is pre-seeded for any role" test — confirms Super Admin, which holds every other grant on
  Business Knowledge, still has no `view_confidential` grant, proving the deny-by-default claim
  against real seeded data rather than a mock.
