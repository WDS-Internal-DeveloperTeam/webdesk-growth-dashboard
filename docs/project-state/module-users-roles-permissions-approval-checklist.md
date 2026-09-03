# Users, Roles and Permissions module backend — approval checklist

## Scope

Module registry key `users_roles_permissions` (`06_Roles_and_Permissions.md` §3's own "Users/roles"
row; RBAC permission-group key `users_roles`). Canonical roadmap instruction: "Phase 1D already
built the RBAC core. Build/administer the UI here; do not redesign authorization architecture."

Confirmed with the project owner (`AskUserQuestion`): **grant viewer + user directory** — a real
user directory (list/search every status, per-user detail with all role assignments, activate/
deactivate with a self-deactivation guard), plus a read-only global RBAC permission-matrix viewer
(7 roles × 21 modules, global-scope grants only). Explicitly out of scope: new role types,
permission-grant editing (the matrix stays migration-seeded), MFA/session-management UI,
confidential-field-access editing. Backend only — no `dashboard-web` UI yet, matching every prior
module's own backend-first precedent.

Branch: `module-users-roles-permissions`, off `main`. No new tables — reuses `users`,
`user_roles`, `roles`, `role_permissions`, `module_registry`. Migration `00118` marks the module
`in_development`; migration `00119` adds `pg_trgm` trigram indexes on `users.email`/
`users.display_name` for the new admin directory search.

## New endpoints

- `GET /users-roles-and-permissions/users` — `users_roles:view`
- `GET /users-roles-and-permissions/users/:userId` — `users_roles:view`
- `POST /users-roles-and-permissions/users/:userId/status` — `users_roles:edit`, `OriginCheckGuard`
- `GET /users-roles-and-permissions/matrix` — `users_roles:view`

## Independent code review

High effort, 8-angle finder pass, 1-vote verification. 10 candidates kept — 9 fixed:

1. Missing malformed-UUID guard on both `:userId` routes — `ParseUUIDPipe` added.
2. `limit` capped at 100 instead of the established 200 convention (the same class of bug that
   caused a real production incident on the Decision and Activity Log module) — raised to 200,
   `offset` also bounded at 200.
3. No guard against deactivating the last active `super_admin` — added
   `assertNotSoleActiveSuperAdmin()`, noting `RoleAssignmentService.revokeRole()` has the
   identical unaddressed gap at the role-revocation layer, left unfixed there as out of scope.
4. Self-deactivation guard bypassed the shared `SeparationOfDutiesService` — rewired through
   `assertDistinctActors()` for a consistent 403 + audit trail.
5. `updateStatus()` had a read-then-write race — closed with a CAS (`expectedStatus`) parameter
   on `UserRepository.updateStatus()`.
6. `PermissionMatrixService` duplicated `RoleAssignmentService`/`CatalogService`'s existing
   role/module mapping — now reuses both directly.
7. New ILIKE search over `users.email`/`display_name` had no supporting index — migration `00119`
   adds `pg_trgm` GIN indexes on both columns.
8. `listAll()`'s pagination had no tiebreaker — added `["id", "ASC"]` as a secondary sort key.
9. `offset` had no upper bound — capped at 200 (folded into fix #2).

**1 left as deliberate, tracked debt**: reusing the `users_roles:edit` action for both role
assignment and account deactivation conflates two different-severity operations under one grant.
Fixing it means a new RBAC seed migration — a separate authorization per the roadmap's own
"do not redesign authorization architecture" instruction. Left unfixed.

## Security review

Focused review (authentication-adjacent surface: account deactivation, session revocation,
lockout-prevention guards — full tier, not light, per the 2026-08-27 standing rule). **1 HIGH
finding, confirmed and fixed**: `assertNotSoleActiveSuperAdmin()` and the
`SeparationOfDutiesService.assertDistinctActors()` self-deactivation check both compared the raw,
attacker-suppliable `userId` path parameter against DB-sourced ids via case-sensitive `===`/`!==`,
while `ParseUUIDPipe` only validates UUID format case-insensitively without canonicalizing case,
and Postgres `uuid` columns compare case-insensitively at the DB layer. A caller could submit a
case-swapped copy of their own id: the DB write would still land on their own row, but both
in-memory guards would fail to recognize the match — deterministically bypassing self-deactivation
protection and, for a sole active `super_admin`, the lockout guard too. Fixed by canonicalizing to
`target.id` (the DB-returned casing) for every subsequent comparison/call in `updateStatus()`.

Everything else checked out clean: `@RequirePermission` is method-level (never class-level) on
every route; `OriginCheckGuard` is present on the one mutating route; `UserEntity`'s field
allowlist excludes any credential/session material; the permission-matrix endpoint reuses
already-`view`-gated services, no new-privilege-level exposure; all search/filter input is
Zod-validated and parameterized via Sequelize with `escapeLikePattern()`.

## Validation

Real local disposable PostgreSQL 17 database: full 119-migration `up` clean, both `pg_trgm`
indexes confirmed present, `module_registry.implementation_status = 'in_development'` confirmed
for the new key. `dashboard-api` typecheck/lint (`--max-warnings=0`)/prettier all clean.
1852/1852 `dashboard-api` unit tests passing (no regression from the existing baseline — this
build adds no new unit test files, per the original build's own scope, matching this project's
precedent for a first backend pass with an already-thorough review round).

## Sign-off

- **Required second-role human review**: WebDesk Solution — **"Approve as-is,"** no disputes
  raised, accepting the 1 open RBAC-granularity finding as tracked debt. 2026-09-03.
- **Gate (G4-users-roles-permissions)**: WebDesk Solution, decision **CONFIRM** (clean pass, not
  an override — the second-role review was already complete before the gate was requested).
  2026-09-03.
