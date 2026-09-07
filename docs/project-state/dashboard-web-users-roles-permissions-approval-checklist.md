# `dashboard-web` Users, Roles and Permissions UI — Approval Checklist

## Scope

Closes this module's last named gap, following the backend's own build-to-production arc
(PR #120, merge commit `7d354e9`). A real user directory (list/search every account status,
per-user detail with every role assignment split global/project-scoped, activate/deactivate) plus
a read-only global permission-matrix viewer (7 roles × 21 permission-group modules × every
global-scope grant). No new-user creation and no grant editing — matching the scope already
confirmed for the backend (item 89's own build). New `packages/shared-types`
`AdminUser`/`AdminUserRoleAssignment`/`AdminUserDetail`/`PermissionMatrixGrant`/`PermissionMatrix`,
mirrored from the backend's own `UserDetail`/`PermissionMatrix` shapes.

## Independent verification

- `@webdesk/shared-types` build clean.
- `dashboard-web`/`dashboard-api`/`dashboard-worker` typecheck clean.
- `eslint --max-warnings=0` clean.
- CSS token check clean (108 files).
- `next build` clean, all 3 new routes present (list, `[userId]` detail, `matrix`).
- `prettier --check` clean.
- 1991/1991 `dashboard-web` unit tests overall (27 new: 6 status-actions, 21 lib), 1852/1852
  `dashboard-api` unit tests unaffected.

## Review

**Reviewed at light tier**, per the 2026-08-27 "right-size the review pipeline" standing rule — a
small, frontend-only UI slice (plus additive shared-types) consuming an already-reviewed,
already-gated backend with no new endpoint. Every backend contract was read directly before
writing against it (`users-directory.controller.ts`, `permission-matrix.controller.ts`,
`users-roles-permissions.dto.ts`, `users-directory.service.ts`, `permission-matrix.service.ts`),
not assumed. A direct read-through pass verified:

- The list page's request shape (`status`/`search`/`limit`/`offset`) against the real
  `listUsersQuerySchema`, and that `getAdminUsers()` correctly uses the backend's real `total`
  rather than the "+1 row" technique every sibling list fetch needs — this is the one endpoint
  that actually returns a count.
- `UserStatusActions`' payload (`{ status: "active" | "disabled" }` via `POST
.../users/:userId/status`) against the real route and `updateUserStatusSchema`; only Deactivate
  is confirmed (`window.confirm`), since the backend revokes every one of the target's sessions on
  a real transition to `disabled` — Activate carries no equivalent risk.
- That self-deactivation and last-active-Super-Admin protection are both left entirely to the
  backend's own real enforcement (403/409, surfaced via `postMutation()`'s error message) rather
  than guessed at client-side — the same "backend is the real gate, UI is convenience" convention
  every other status-actions component in this app already follows.
- The permission-matrix page's action-letter map (`V`/`C`/`E`/`S`/`R`/`A`/`P`/`L`/`X`/`M`) against
  the real `LETTER_ACTIONS` map in `packages/database/src/migrations/00013-seed-rbac-matrix.ts`,
  confirming `publish`/`unpublish` both correctly collapse to `P` and `release`/`rollback` to `L`.
- Reuse of every established shared helper (`postMutation`, `useSyncedState`, `isUuid`,
  `firstValue`, `list-filter-styles`, `list-table-styles`, `detail-section-styles`, `pagination`).

**0 findings.**

No separate security review — no new backend endpoint, no new RBAC action, no new sink; every
mutation routes through the already-audited `postMutation()`, and the one genuinely sensitive
transition (deactivation) is enforced entirely server-side, unchanged by this diff.

## Sign-off

Required second-role human review, per ADR-0010 (the implementing agent cannot also be its own
reviewer): **Approved**, WebDesk Solution, 2026-09-07, via the direct "Commit, gate it, and push
the branch" instruction — the findings summary above (0 findings) served as the review artifact,
since this slice was reviewed at light tier.

Gate `G4-dashboard-web-users-roles-permissions`: **CONFIRM** — WebDesk Solution, 2026-09-07,
approved commit `47f61bd` on branch `dashboard-web-users-roles-permissions`.

Push authorization was given together with the gate as one combined instruction — opening a PR and
merge each remain their own separate, not-yet-requested authorization, per this project's standing
"no auto-merge" rule.
