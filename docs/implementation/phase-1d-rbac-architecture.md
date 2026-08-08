# Phase 1D (Expanded) — RBAC/Authorization Architecture

**Status:** Draft, produced during implementation of
`docs/task-packages/phase-1d-rbac-permissions-expanded.md`. Describes what is actually built,
not an aspirational design — every claim below is backed by real source files and real-database
tests referenced inline.

## 1. Centralized authorization service

`apps/dashboard-api/src/authz/authorization.service.ts`'s `AuthorizationService` is the single
place grant logic lives (task package §13). It retires the narrower Phase 1D (PR #8)
`PermissionService` outright — deleted, not kept in parallel — so there is exactly one code path
that can say yes or no to an access decision.

API surface (all methods take `(userId, moduleKey, action, projectId?)`-shaped arguments — a
`(moduleKey, action)` **pair**, not a `"moduleKey.action"` string; see
`docs/implementation/phase-1d-permission-catalog.md §5` for why):

- `evaluate(userId, moduleKey, action, projectId?) → { allowed, reasonCode }` — the only method
  that actually queries the database. Every other method is a thin wrapper around it.
- `can(...) → boolean` — collapses `evaluate()`'s result.
- `canViewConfidential(userId, moduleKey, projectId?)` / `canEditConfidential(...)` — check the
  `view_confidential`/`edit_confidential` actions specifically (task package §11).
- `getEffectiveCapabilities(userId, projectId?) → Record<moduleKey, action[]>` — one query for the
  user's role IDs, one query for all grants across those roles
  (`RolePermissionRepository.listGrantsForRoles`), grouped and deduplicated in memory. Verified
  by `authorization.service.spec.ts`'s own N+1 regression test (asserts each repository method is
  called exactly once regardless of role/module count).
- `recordAccessDenied(userId, moduleKey, action, reasonCode)` — records a
  `privileged_access_denied` auth event (§22).

`PermissionGuard` (`apps/dashboard-api/src/authz/permission.guard.ts`) is pure request plumbing:
extract the authenticated user and an optional `:projectId` route param, call
`AuthorizationService.evaluate()`, translate a denial into a `ForbiddenException` and a recorded
event. It contains no grant-check logic of its own.

## 2. Module registry — two granularities

`role_permissions` continues to reference the existing 21-row `modules` table (the real seeded
458-grant matrix's own granularity). A new `module_registry` table (migration `00014`/`00015`)
maps the 43 real dashboard modules to whichever of the 21 `modules` rows gates them. See
`docs/implementation/phase-1d-permission-catalog.md §3` for the full rationale and
`docs/implementation/phase-1d-role-permission-matrix.md` for the 43→21 mapping table.

## 3. Project-scoped authorization

`user_roles.project_id` (migration `00016`, nullable UUID, deliberately not FK-constrained — no
`projects` table exists, and creating one is outside this phase's authorization) controls **where**
a user is considered to hold a role: `UserRoleRepository.findRoleIdsForUser(userId, projectId?)`
matches rows where `project_id IS NULL` (global) OR `project_id = :projectId`. Once a role is
resolved as held, its own grants (`role_permissions`) are still evaluated as today — seeded
globally in migration `00013` — so project-scoping the _assignment_ does not create a separate
copy of what the role can do; a genuinely project-specific _grant_ would be a `role_permissions`
row with a real `project_id`, which no admin surface writes yet (schema-ready, unexercised). See
`packages/database/test/phase1d-authz.integration.test.ts`'s "project-scoped authorization" suite
for the real-database proof of this behavior, including the two-directional case (same role held
both globally and in one specific project simultaneously).

## 4. Confidential-field authorization

`view_confidential`/`edit_confidential` are real actions in the grant vocabulary, checked via
`AuthorizationService.canViewConfidential`/`canEditConfidential`, but **zero rows are seeded** for
any role (task package §11, `06_Roles_and_Permissions.md §3`'s "Configurable" ≠ "Yes" — see
`docs/implementation/phase-1d-permission-catalog.md §4`). `confidential-field.util.ts`'s
`redactConfidentialFields`/`redactConfidentialFieldsFromList` are pure, entity-agnostic redaction
functions a future business module calls once one exists with real confidential fields; no
business entity is fabricated here to exercise them (tested against an explicitly-labeled
illustrative-only fixture instead).

## 5. Separation of duties

`SeparationOfDutiesService` (`apps/dashboard-api/src/auth/common/separation-of-duties.service.ts`)
is the one reusable primitive every future approval workflow calls, not something each workflow
reinvents:

- `assertDistinctActors(approverId, actorId, context)` — throws if the two are the same. Used by
  `RoleAssignmentService.assignRole`/`revokeRole` to block self-role-assignment (task package
  §21/§33) — this closes the gap `docs/security/threat-model-authorization-rbac.md` originally
  flagged as an open decision for the second-role reviewer in PR #8, per this brief's own explicit
  instruction, not a unilateral fix.
- `assertNoPriorConflictingAction(resourceType, resourceId, priorActionType, actorId, context)` /
  `recordAction(...)` — generalizes beyond the same-request shape, using the new
  `authorization_actions` append-only table (migration `00017`) to check whether the current actor
  already performed a different, conflicting action on the same resource in an earlier request
  (e.g. "implemented" vs. "reviewed" a code change). No business workflow table exists yet to call
  this today — it is the reusable foundation those future workflows use, per the brief's own
  framing ("establishes the reusable policy foundation ... full workflow modules may come later").

Every `assertDistinctActors` denial records a `separation_of_duties_denied` auth event (§22)
before rethrowing, verified end-to-end against a real database in `authz.e2e-spec.ts`'s
"privilege escalation" suite (asserts both the HTTP 403 and the persisted event row).

## 6. Caching and authorization freshness (task package §23)

**Decision: no authorization caching layer exists.** Every `AuthorizationService` call —
`evaluate()`, `can()`, `canViewConfidential()`/`canEditConfidential()`,
`getEffectiveCapabilities()` — resolves the user's roles and grants from PostgreSQL on every
request. `GET /me/capabilities` (the one endpoint `dashboard-web` would use to drive nav/UX) is
no exception: it calls `getEffectiveCapabilities()` fresh each time, not from a cached snapshot.

This is a deliberate application of the task package's own instruction ("prefer correctness over
premature authorization caching"): with the real grant matrix at 458 rows and the effective-
capabilities query already reduced to two queries total (role IDs, then grants — see §1's N+1
note), there is no measured performance problem caching would solve, and no caching layer means
none of §23's failure modes (stale cache keys missing user/project/version context, revoked
permissions remaining effective until a long expiry, confidential data cached across users) can
occur. If a real caching layer is introduced later, it must satisfy all of §23's constraints
before it ships — this document's "no cache" decision is not a prohibition on ever adding one.

Browser-side: `dashboard-web` is not implemented in this phase (no business UI exists to hide/show
based on capabilities yet), so "do not rely on browser caching as authorization state" has no
current surface to violate — noted here as a constraint the eventual frontend implementation must
honor, not a gap in this phase's own scope.

## 7. Session interaction (task package §24)

**Decision: both approved strategies are implemented, not just one.**

1. **Resolve permissions server-side per request** (§6's design) — since there is no caching layer
   (§6/§23 above), every authorization check is already against current data; there is no stale
   in-memory or cached capability set that could diverge from the database.
2. **Revoke sessions after high-risk privilege changes** — `RoleAssignmentService.assignRole`/
   `revokeRole` call `SessionService.revokeAllForUser(targetUserId, "role-change", now)`
   immediately after a role change succeeds (pre-existing behavior from PR #8, unchanged by this
   expansion). A user's outstanding session cookie becomes unauthenticated (401), not merely
   re-denied (403), the moment their roles change — proven end-to-end against a real database in
   both `authz.e2e-spec.ts` ("assigns the role ... and revokes the target user's existing
   session" / the equivalent revoke test) and the unit suite.

Together these mean a privilege change is never observable as "still has old access" for longer
than the time until the user's _next_ authenticated request (which re-resolves permissions fresh
per point 1) or, for the specific case of a role change, until their existing session cookie is
rejected outright (point 2). Neither approach requires waiting for a session's natural expiry.

## 8. What this document does not cover

The permission-action vocabulary and its sourcing (`docs/implementation/phase-1d-permission-catalog.md`),
the full 43→21 module mapping table (`docs/implementation/phase-1d-role-permission-matrix.md`),
the separation-of-duties design in full detail (`docs/implementation/phase-1d-separation-of-duties.md`),
confidential-field authorization in full detail
(`docs/implementation/phase-1d-confidential-field-authorization.md`), and the file-by-file change
inventory (`docs/implementation/phase-1d-file-inventory.md`) are each their own required document
per task package §29.
