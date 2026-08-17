# Projects Module — Backend Close-Out (as-built)

**Status:** Built and validated on branch `module-projects-backend-closeout`. Not yet reviewed or
merged.

## 1. Why this exists

The user is about to share a dashboard design prompt that will drive a phase of wiring up the
Projects module's remaining frontend gaps (team management UI, approver-assignment UI, sub-resource
create/edit/delete UI, and eventually "current project" context propagation). Before that UI phase
starts, an explicit backend/API audit was requested — read the actual code, not documentation
summaries, to confirm every capability the eventual UI will need already has a working, tested HTTP
endpoint.

The audit (full report given inline in that conversation turn) found the Projects module's backend
was almost entirely code-complete, but surfaced three real gaps and a systemic test-coverage gap.
This branch closes all of them.

## 2. What was fixed

### a. Missing capability: no endpoint to list a project's current approvers

Add/remove approver endpoints existed and were tested, but nothing let a future UI answer "who are
the current approvers for this project?" `RoleAssignmentService.listRolesForUser()` has no
`projectId`-aware inverse, and no repository method answered "which users hold role R scoped to
project P."

Fixed:

- `packages/database/src/authz/user-role.repository.ts` gained
  `findUserIdsForRoleInProject(roleId, projectId)` — the inverse of the existing
  `findRoleIdsForUser()`.
- `AuthzModule` now additionally exports `USER_ROLE_REPOSITORY` (previously only
  `RoleAssignmentService`/`ROLE_REPOSITORY`).
- `UsersModule` now exports `UsersService` (previously provided but not exported), so other modules
  can resolve a bare user id to a display summary the same way the picker UI does.
- `ProjectApproversService` gained a `list(projectId)` method: resolves the seeded
  `owner_growth_approver` role, queries `findUserIdsForRoleInProject`, and resolves each id to a
  `UserSummary` via `UsersService` — silently dropping any id that no longer resolves (e.g. a
  since-disabled account), matching this codebase's established "disabled = not found" convention.
- `ProjectsController` gained `GET /projects/:projectId/approvers`, gated on
  `project_configuration:view` (the same permission every other project sub-resource list route
  uses) — unlike assignment, reading who the current approvers are carries no privilege-escalation
  risk, so no additional internal check was needed.

### b. Known-but-unfixed security debt: environment `url` accepted any scheme

The 2026-08-16 security review on the Project Detail page found a stored-XSS path via
`ProjectEnvironment.url` rendered as a clickable link with no scheme restriction, fixed it
client-side (`isSafeHttpUrl()`), and explicitly flagged the backend schema
(`createEnvironmentSchema`/`updateEnvironmentSchema`'s plain `z.string().url()`) as the real place
to close it — deferred as out-of-scope for that branch. Never picked up until now.

Fixed: both schemas now use a shared `safeHttpUrl` Zod schema (`projects.dto.ts`) that additionally
refines the URL to have an `http:`/`https:` protocol, rejecting `javascript:` and any other scheme
with a clean 400 at the API boundary — closing the vulnerability for every future consumer, not
just the one page that happened to add its own client-side guard.

### c. Untested reliability gap: `ownerUserId` had no existence check before the database write

`ownerUserId` is FK-constrained at the database layer, so a garbage id could never corrupt data —
but the FK violation itself would surface as an opaque, unhandled 500 rather than a clean, actionable 400. Untested, so this was unverified behavior, not confirmed-safe.

Fixed: `ProjectService` now injects `UserRepository` (re-declared in
`projects/database.providers.ts`, the same "re-declare, don't cross-import" pattern this codebase
already uses elsewhere) and validates a proposed `ownerUserId` resolves to a real, **active** user —
via a new private `assertOwnerExists()` — before every write in both `create()` and `update()`.
Clearing the owner (`ownerUserId: null`) is always allowed with no check, matching the picker UI's
own contract.

### d. Systemic gap: 4 of 6 project sub-resource controllers had zero test coverage

`ProjectTeamService`, `ProjectEnvironmentsService`, `ProjectObjectivesService`, and
`ProjectRepositoriesService` had no unit spec files at all, and the e2e suite never hit `/update`,
`/team`, `/environments`, `/objectives`, or `/repositories`, nor `GET`/`POST update` on
`/roadmap-items`. The code was correct by inspection, but "tested" could not honestly be claimed.

Fixed: four new unit spec files
(`project-team.service.spec.ts`, `project-environments.service.spec.ts`,
`project-objectives.service.spec.ts`, `project-repositories.service.spec.ts`), plus new
`describe` blocks in `project.service.spec.ts` (`update`, including the new `ownerUserId`
validation paths) and `roadmap-items.service.spec.ts` (`create`, `listByProject`, `update`). The
e2e suite (`projects.e2e-spec.ts`) gained 9 new tests covering `/update` (success + the
`ownerUserId` rejection path), the full team roster CRUD cycle, the full environments CRUD cycle
(plus the `javascript:` rejection), objectives CRUD, repositories CRUD, roadmap-items list/update,
and the new approvers-list endpoint.

## 3. Validation

All against a fresh local disposable PostgreSQL database:

- 359/359 `dashboard-api` unit tests (37 new: 3 approvers-list tests, 6 project.service `update`
  tests, 5 team, 6 environments, 6 objectives, 6 repositories, 3 new roadmap-items tests, plus
  constructor-signature fixes to 2 existing spec files).
- 102/102 `dashboard-api` e2e/integration tests (9 new).
- 122/122 `packages/database` integration tests (unaffected, confirmed still green).
- Typecheck, lint (`--max-warnings=0`), `nest build`, and `pnpm exec prettier --check` all clean
  across `dashboard-api` and `packages/database`.

## 4. Independent code review (medium effort, 8-angle finder pass)

Ran this project's own `code-review` skill against the branch. 10 candidates surfaced after
dedup — 7 CONFIRMED, 3 PLAUSIBLE. 9 fixed; 1 accepted as tracked debt.

1. **CONFIRMED — owner-validation regression on unrelated edits.** `update()` re-validated
   `ownerUserId` against `UsersService` on every call, even when the patch resent the project's
   own already-stored, unchanged value — which `dashboard-web`'s edit form always does, since it
   can't distinguish "picker untouched" from "picker cleared." A project whose owner had since
   been disabled would reject _any_ unrelated edit (e.g. renaming) with a 400. Fixed: `update()`
   now only re-validates when `ownerUserId` is actually changing (`patch.ownerUserId !==
project.ownerUserId`).
2. **CONFIRMED — error-swallowing in the approvers list.** `.catch(() => null)` around each
   `usersService.findById()` call hid any error class, not just a genuine not-found. Fixed as a
   side effect of finding 8 below — batch resolution via `UsersService.findByIds()` has no
   per-item catch at all; a real database error now propagates normally.
3. **CONFIRMED — PII exposure via the wrong permission gate.** `GET
/:projectId/approvers` reused the sibling routes' `project_configuration:view` gate, but this
   route returns RBAC role-membership data (display names, emails), the same data
   `role-assignment.controller.ts` already gates on `users_roles:view` — not project-configuration
   content. A `read_only`-only session (holds `project_configuration:view`, no `users_roles` grant
   at all) could read every approver's identity. Fixed: gate changed to `users_roles:view`; a new
   e2e regression test proves a `read_only` session now gets `403`.
4. **CONFIRMED — duplicated active-user-check logic.** `assertOwnerExists()` re-declared its own
   `UserRepository`/`USER_REPOSITORY` binding and hand-rolled the same check `UsersService.findById()`
   already implements (including its malformed-UUID short-circuit). Fixed: `ProjectService` now
   depends on `UsersService` (already available via `ProjectsModule`'s existing `UsersModule`
   import) instead; the redundant provider binding was removed from `database.providers.ts`.
5. **CONFIRMED — no covering index for the new approvers-list query.** `user_roles`' two existing
   indexes both lead with `user_id`; `findUserIdsForRoleInProject()`'s `WHERE role_id = ? AND
project_id = ?` has no `user_id` predicate, so it fell back to a full table scan. Fixed: migration
   `00045` adds a `(role_id, project_id)` index.
6. **PLAUSIBLE — AuthzModule over-exposed a write-capable repository.** `AuthzModule` exported
   `USER_ROLE_REPOSITORY` just so `ProjectApproversService` could read from it directly, handing
   that consumer DI access to `assign()`/`revoke()` it never needed — the same class of
   self-invented authorization bypass this codebase's task packages explicitly forbid. Fixed: added
   `RoleAssignmentService.findUserIdsForRoleInProject()`, a thin delegating read method;
   `AuthzModule`'s export list reverted to omit `USER_ROLE_REPOSITORY`;
   `ProjectApproversService` now depends on `RoleAssignmentService` only.
7. **CONFIRMED — `safeHttpUrl` duplicated instead of shared.** The http(s)-only URL-scheme check
   was defined locally in `projects.dto.ts`, with `packages/validation` existing as the intended
   shared-schema location (its own package description: "consumed by dashboard-web... and
   dashboard-api... so both sides validate against the exact same schema"). Fixed: moved to
   `packages/validation` as `safeHttpUrlSchema`, imported from there.
8. **CONFIRMED — N+1 query resolving approver identities.** `list()` resolved each approver's
   identity via an individual `usersService.findById()` call inside `Promise.all()`. Fixed: added
   `UserRepository.findByIds()`/`UsersService.findByIds()` (batch resolve, same "disabled = not
   found" convention as the single-id path, silently dropping any id that doesn't resolve) —
   `list()` is now one query, not N.
9. **CONFIRMED — independent checks in `create()` ran sequentially.** `findByPublicId()` and the
   owner-existence check don't depend on each other's result but were awaited one after another.
   Fixed: both now run inside a single `Promise.all()`.
10. **PLAUSIBLE, accepted as tracked debt — TOCTOU gap between the owner check and the write.**
    An account could theoretically be disabled in the narrow window between
    `assertOwnerExists()` resolving and the write executing. Not fixed: `accountStatus` only
    changes via operator-run CLI scripts, never concurrent HTTP, so this window isn't practically
    reachable; `ownerUserId` also carries no authorization weight, so the impact of a stale value
    is cosmetic. A real fix would need a database transaction/row-lock spanning both the check and
    the write — disproportionate to a non-reachable, low-impact gap.

All 9 applied fixes re-validated: 363/363 `dashboard-api` unit tests (16 new), 125/125
`packages/database` integration tests (4 new), 103/103 `dashboard-api` integration/e2e tests (18
Projects tests, up from 16), migration `00045` up/down round-trip clean, typecheck/lint/`nest
build`/prettier all clean, `pnpm audit` 0 vulnerabilities.

## 5. Not yet reviewed or merged

Pushed as its own branch (`module-projects-backend-closeout`). Security review, second-role human
review, a gate decision, and merge authorization are each their own separate, not-yet-requested
next step, unchanged from this project's standing discipline for every prior slice.
