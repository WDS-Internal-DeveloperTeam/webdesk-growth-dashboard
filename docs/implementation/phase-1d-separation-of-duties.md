# Phase 1D (Expanded) — Separation of Duties

**Status:** Draft, produced during implementation of
`docs/task-packages/phase-1d-rbac-permissions-expanded.md` §9/§21.

## 1. Source requirement

`06_Roles_and_Permissions.md §4`:

- A developer cannot approve their own code review.
- A content author should not be the sole final approver of the same content.
- Production release requires an authorized approver separate from the implementer where practical.
- Security exceptions require Security Owner or Super Admin authority.
- Local emergency-admin recovery requires a second authorized administrator.

`knowledge/12-dashboard-security-controls.md`: separation of duties must be enforced "not merely
by convention or UI hint" — i.e. at the service layer, server-side.

## 2. The reusable primitive: `SeparationOfDutiesService`

`apps/dashboard-api/src/auth/common/separation-of-duties.service.ts`. Two methods, two different
shapes of conflict:

### 2.1 `assertDistinctActors(approverId, actorId, context)`

Same-request check: the actor performing the current action and the actor it targets/approves
cannot be the same person. Throws `ForbiddenException` synchronously if they match — never
returns a boolean for a caller to accidentally ignore.

**Real callers today:**

- `RoleAssignmentService.assignRole`/`revokeRole` — blocks self-role-assignment (task package
  §21/§33: "Do not allow self-assignment of privileged roles"). This closes the gap
  `docs/security/threat-model-authorization-rbac.md` flagged as an open decision for the
  second-role reviewer in PR #8 — closed now under this brief's own explicit instruction, not a
  unilateral fix.
- Phase 1C's `RecoveryService` — a recovery-request subject cannot approve their own recovery
  (pre-existing from Phase 1C, unchanged by this expansion).

Every denial records a `separation_of_duties_denied` auth event (§22) before rethrowing —
implemented in `RoleAssignmentService`'s private `assertNotSelfTargeting` wrapper, verified
end-to-end against a real database in `authz.e2e-spec.ts`'s "privilege escalation" suite (asserts
both the HTTP 403 and the persisted `auth_events` row).

### 2.2 `assertNoPriorConflictingAction(resourceType, resourceId, priorActionType, actorId, context)` + `recordAction(...)`

Cross-request check, using the new append-only `authorization_actions` table (migration `00017`):
did this actor already perform a _different, specific_ action on this exact resource in an earlier
request? This is what `assertDistinctActors` alone cannot see — e.g. "the developer who
`implemented` a code change cannot also `reviewed` it," where implementation and review happen in
separate requests, potentially days apart.

**No caller uses this today.** No code-review, release, or task business table exists yet in
`packages/database` (those are separate, later authorizations per `CLAUDE.md`'s standing caution
against fabricating business entities). This method and `authorization_actions` are the reusable
foundation those future workflows call, per the task package's own framing: "establishes the
reusable policy foundation ... full workflow modules may come later." Proven correct in isolation
against a real database — `packages/database/test/phase1d-authz.integration.test.ts`'s
"authorization_actions" suite records an action, confirms `findActorsForResource` finds the actor
for the exact `(resourceType, resourceId, actionType)` triple, and confirms a different action
type on the same resource finds no one — and at the unit level in
`separation-of-duties.service.spec.ts`.

## 3. Mapping source requirements to implementation status

| Source requirement                                               | Status                                                                                                            |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Developer cannot approve their own code review                   | Foundation ready (`assertNoPriorConflictingAction`); no code-review business table exists yet to call it against. |
| Content author not sole final approver of same content           | Foundation ready; no content-approval business workflow exists yet.                                               |
| Release requires approver separate from implementer              | Foundation ready; no release business workflow exists yet (Release Center is UI/API-absent this phase).           |
| Security exceptions require Security Owner/Super Admin           | Not yet modeled — no "security exception" business concept exists in code yet.                                    |
| Emergency-admin recovery requires a second administrator         | **Implemented**, Phase 1C, via `assertDistinctActors` in `RecoveryService` — unchanged by this phase.             |
| Self-role-assignment is blocked (this phase's own addition, §21) | **Implemented**, this phase, via `assertDistinctActors` in `RoleAssignmentService`.                               |

Rows marked "foundation ready" are a deliberate, documented scope boundary, not an oversight: the
task package's own §32 ("Explicitly out of scope") excludes building the 21 real business modules
in this phase, and a separation-of-duties check with nothing to check against would be dead code
exercising a business entity this phase is not authorized to create.
