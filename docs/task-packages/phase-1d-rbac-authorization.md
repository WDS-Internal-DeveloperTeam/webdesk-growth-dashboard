# Phase 1D Task Package — RBAC and Authorization (Task 6)

**Status:** Authorized to execute — the user explicitly instructed "Begin RBAC (Task 6)" after
Phase 1C merged (PR #7, `102397d2f1aaf9fc5d374dd4bd58c764cb031ef9`). Written concurrently with
execution, same pattern as `docs/task-packages/phase-1c-authentication-sessions.md`.

## 1. Task ID

`PHASE-1D-TASK-6-RBAC-AUTHORIZATION`

Corresponds to `docs/phase-plans/phase-1-foundation-plan.md`'s **Task 6 — RBAC and authorization**.

## 2. Dependencies — verified

| Check                           | Result                                                                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Task 3 (database foundation)    | **Confirmed approved** — Phase 1B, G-Schema gate passed.                                                                        |
| Task 5 (sessions)               | **Confirmed merged** — Phase 1C, PR #7 merged to `main` at `102397d2f1aaf9fc5d374dd4bd58c764cb031ef9`.                          |
| Role/permission model specified | **Confirmed** — `06_Roles_and_Permissions.md` is complete and already-approved; ADR-0010's own "Open setup values" says "None." |
| Explicit go-ahead               | **Confirmed this session**, in chat: "Begin RBAC (Task 6)".                                                                     |

## 3. Purpose

Turn ADR-0010's already-approved architecture into a real, tested, server-side-enforced RBAC
framework: the `role × module × action` permission model (base skill `security/02-authn-authz.md`,
extended per `knowledge/12-dashboard-security-controls.md`'s four-axis model), deny-by-default,
seeded with the real, already-approved role/module/matrix data from `06_Roles_and_Permissions.md`
— not placeholder data, since none of it is an open setup value.

## 4. In scope

- **Schema**: `roles` (seeded with the 7 real roles), `modules` (seeded with the 21 real module
  keys from `06_Roles_and_Permissions.md §3`), `role_permissions` (`role_id`, `module_id`,
  `action`, `confidential_field` — one row per granted `(role, module, action)`, VED-equivalent
  extensible per knowledge/12's action vocabulary), `user_roles` (many-to-many user↔role
  assignment, since nothing in the spec restricts a user to exactly one role).
- **Seed data**: the full matrix from `06_Roles_and_Permissions.md §3` translated into
  `role_permissions` rows, plus §5's confidential-field defaults (denied by default for every
  role except where the matrix marks it configurable/limited).
- **`PermissionService.can(userId, moduleKey, action, { confidentialField? })`** — deny-by-default;
  a role with no grant row denies. Checked server-side only, per ADR-0010 (never a UI-only hide).
- **`RequirePermission` decorator + guard** — every protected route declares its module+action;
  the guard reads the authenticated session (Phase 1C) and calls `PermissionService.can`, never
  trusts a client-supplied role/permission claim.
- **Confidential-field axis** — independent of the general view/edit grant on a module, per
  knowledge/12: "A grant at one axis never implies a grant at another."
- **Project-level axis** — schema-ready (`role_permissions.project_id`, nullable) but **not
  functionally scoped yet** — the dashboard's `projects` business entity doesn't exist until Task
  8 (separate, not-yet-authorized). Every check in this phase operates at global scope
  (`project_id IS NULL`); this is documented, not silently assumed complete.
- **Separation-of-duties primitive** — a reusable `assertDistinctActors(approverId, submitterId)`
  helper for future approval workflows (`06_Roles_and_Permissions.md §4`), not yet wired to any
  real approval flow (none exists yet — Case Studies, Releases, etc. are later modules).
- **Role-assignment endpoints** — `GET /authz/roles`, `GET /authz/users/:userId/roles`,
  `POST`/`DELETE /authz/users/:userId/roles/:roleId`, gated by the **"Users/roles"** module's own
  permissions from the real matrix (Super Admin: full; Owner/Growth: manage, limited; everyone
  else: no access). This is the "Users/roles" row of the matrix itself, not a fabricated example
  surface — a real, self-consistent way to prove and use the framework without a fake business
  module. A role change revokes the affected user's existing sessions (reusing Phase 1C's
  `SessionService.revokeAllForUser(userId, "role-change")`), per knowledge/12's "Operational
  considerations."
- **Audit events** — `role_assigned`/`role_revoked`, per `06_Roles_and_Permissions.md §6`'s "role
  and permission changes" requirement. Narrow, same pattern as Phase 1C's `auth_events` — not the
  general ADR-0017 subsystem (Task 7, still separate).
- STRIDE pass for "Authorization" (`docs/security/threat-model-plan.md`'s required coverage,
  distinct from the existing Authentication/Session-handling document).

## 5. Out of scope — explicitly, to prevent scope creep

- Any of the 21 real business modules' actual CRUD endpoints (Business Knowledge, Page Content,
  Case Studies, Portfolio, Releases, etc.) — those features don't exist as code yet; this phase
  only builds the permission _framework_ they will each call once built. Their module _keys_ are
  seeded now (real, approved data), their _endpoints_ are not.
- Project-scoped enforcement actually filtering by a real project — Task 8, separate authorization.
- User-management CRUD/admin UI beyond role assignment itself — Task 8.
- The general ADR-0017 audit-log subsystem — Task 7.
- Wiring the separation-of-duties primitive into a real approval workflow — no approval workflow
  exists yet.
- User activation/deactivation, approval-authority changes, production-release-authority changes
  as audit event types — `06_Roles_and_Permissions.md §6` lists these, but none has a
  corresponding feature yet; only role/permission-change events are wired now.
- A `dashboard-web` admin UI for role assignment — API-only for this phase, same "foundation
  before UI" pattern as Phase 1C's recovery-request feature.

## 6. Test requirements

Deny-by-default proven directly (a role/module/action combination with no grant row denies).
Every one of the 7 roles tested against a representative slice of the real matrix — both a
granted action (allow) and a plausible non-granted action (deny) per role, not just Super Admin.
Confidential-field independence proven (a role with general `view` but no confidential-field grant
is denied on the confidential-field check). Separation-of-duties primitive tested directly
(same actor as both approver and submitter → rejected). Role-assignment endpoints tested
end-to-end against a real database, including the session-revocation side effect.

## 7. Security checks

STRIDE pass for "Authorization" — privilege escalation via a missing or incorrectly-scoped
server-side check (the exact risk `docs/security/threat-model-plan.md` names for this area).

## 8. Approval gate

G4 (per `docs/phase-plans/phase-1-foundation-plan.md` Task 6). No client-side-only permission
check ever treated as sufficient, per that task's own forbidden-actions list.

## 9. Forbidden actions

- No client-side-only permission check as the actual enforcement mechanism.
- No fabricated/placeholder role, module, or matrix data where `06_Roles_and_Permissions.md`
  already specifies the real value.
- No real business-module endpoints built ahead of their own authorization (out of scope §5).
- No merge without a separate, explicit "merge" instruction.
