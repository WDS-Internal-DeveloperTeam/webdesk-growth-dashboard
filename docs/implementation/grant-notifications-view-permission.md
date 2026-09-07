# Grant `notifications_view` to `super_admin`

## Scope

Not started automatically — built directly on the explicit "Grant a role notifications_view
permission" instruction, closing the flagged, declined-scope gap recorded in
`docs/implementation/dashboard-web-notification-center.md`: `notifications_view`/
`notifications_configure` (the `system_settings` module's two bespoke, non-letter-code
actions guarding every Notification Center route) were left zero-seeded when that backend/UI
were built, meaning every route the UI calls 403s for every real user today.

Which role should receive the grant was confirmed directly (`AskUserQuestion`): **`super_admin`**,
since it already holds every other `system_settings` action (`VCERM`, seeded in
`00013-seed-rbac-matrix.ts:266-269`) and is the role the one currently-provisioned production user
holds. `notifications_configure` and any other role stay zero-seeded — out of scope for this
request.

## As-built

New migration `packages/database/src/migrations/00117-grant-notifications-view-to-super-admin.ts`
(renumbered from `00115` during a merge with `main`, which had concurrently claimed migrations
`00115`/`00116` for the unrelated Help Center module).
Grants only work as a static migration in this system — `role_permissions` (migration `00011`) has
no runtime HTTP mechanism to add a grant to a role (`RoleAssignmentController`/`Service` only
assign/revoke a **user** to/from a role, never edit a role's own permission grants). The migration
inserts one `role_permissions` row (`role_id` = `super_admin`, `module_id` = `system_settings`,
`action = 'notifications_view'`), resolved by joining on the roles'/modules' real `key` columns,
not a hardcoded id. `ON CONFLICT (role_id, module_id, action) WHERE project_id IS NULL DO NOTHING`
against the real partial unique index (`role_permissions_global_scope_unique`) makes it safely
re-runnable. `down()` deletes only that exact `(role, module, action)` triple, never a broader
delete.

No application code changed — `NotificationsController`'s `@RequirePermission("system_settings",
"notifications_view")` decorators and `PermissionGuard`'s enforcement are both unchanged; this is
purely additive seed data through the system's existing, unmodified authorization mechanism.

## Validation

Run against a real local disposable PostgreSQL 17 database (`webdesk_notif_grant_test`, dropped
after use — never against production; the standing convention is the user runs the real production
migration themselves):

- Full `migrate up` (all 117 migrations, including the concurrently-merged Help Center's own
  `00115`/`00116`) — clean, `00117` applies without error.
- Verified exactly one row landed: `super_admin` / `system_settings` / `notifications_view` — no
  other role or action affected.
- `migrate down` on `00117` alone, confirmed the row is gone (count 0), then `migrate up` again,
  confirmed it's back (count 1) — a clean down/up round-trip.
- `pnpm --filter @webdesk/database typecheck` / `lint` — clean.
- `pnpm --filter @webdesk/database test` — 28/28 unit tests passing (no test asserts on
  `role_permissions` row counts, so no update was needed).
- `prettier --check` — clean.

## Review

This is a genuine RBAC/permission change, which this project's own 2026-08-27 "right-size the
review pipeline" standing rule reserves for the full review tier by default. Given the change's
real shape — a single additive migration, no application/enforcement code touched, granting only a
**read** action (`view`, not `configure`) to the role that already holds every other action on
this exact module — a direct, careful security-focused read-through was judged proportionate
rather than an 8-angle fan-out on a one-file diff:

- Confirmed the `up()` migration's `WHERE` clause resolves to exactly one `(role, module)` pair
  (`roles.key = 'super_admin' AND modules.key = 'system_settings'`), not a broader match.
- Confirmed the `ON CONFLICT` target matches the real partial unique index exactly (verified by
  running it twice in a row against the same database — the second run stayed a no-op, not a
  duplicate-key error).
- Confirmed `down()` is scoped to the exact `(role, module, action)` triple, not a blanket delete
  of `system_settings` grants or of `super_admin`'s other grants.
- Confirmed no application code changed — the enforcement point (`PermissionGuard` +
  `@RequirePermission`) is unmodified; this migration only ever makes an existing, already-audited
  check start succeeding for one role on one read action.
- Confirmed no SQL-injection surface — every value in both queries is a static literal, no
  interpolated input.

**0 findings.**

---

## Slice 2: Grant `notifications_view` to `owner_growth_approver`

### Scope

Not started automatically — built on the explicit "start whatever missing in the notification
center" instruction. Investigated the module first and reported it as functionally live but
practically unusable by anyone except `super_admin` (see the notification-center review this
followed). Presented four possible next steps directly (`AskUserQuestion`): widen the
`notifications_view` grant, grant `notifications_configure`, add a dedicated RBAC permission
group, or build real SMTP delivery. **The user chose to widen `notifications_view`** and, when
asked which role, chose **`owner_growth_approver`** — it already holds nearly every other
`system_settings` action alongside `super_admin`. `notifications_configure` stays zero-seeded for
every role — out of scope for this request, same as slice 1.

### As-built

New migration
`packages/database/src/migrations/00125-grant-notifications-view-to-owner-growth-approver.ts`, off
`main` at commit `35e612e` (post–PR #128). Identical shape to slice 1's own migration — one
`role_permissions` row (`role_id` = `owner_growth_approver`, `module_id` = `system_settings`,
`action = 'notifications_view'`), resolved by joining on the real `key` columns, guarded by the
same `ON CONFLICT (role_id, module_id, action) WHERE project_id IS NULL DO NOTHING` against the
real partial unique index, safely re-runnable. `down()` deletes only that exact
`(role, module, action)` triple. No application code changed.

### Validation

Run against a fresh local disposable PostgreSQL 17 database (`webdesk_notif_test`, dropped after
use — never against production):

- Full `migrate up` (all 125 migrations) — clean, `00125` applies without error.
- Verified exactly two rows now hold `notifications_view`: `super_admin` and
  `owner_growth_approver`, both on `system_settings` — no other role or action affected.
- `migrate down` on `00125` alone (row count → 1, `super_admin` only), then `migrate up` again
  (row count → 2 again, no duplicate) — a clean down/up round-trip, confirming `ON CONFLICT`
  idempotency held under a real re-run.
- `pnpm --filter @webdesk/database typecheck` — clean.
- `prettier --check` on the new file — clean.

### Review

Reviewed the same way as slice 1 — a genuine RBAC/permission change, but a one-file, additive,
read-only-grant diff mirroring an already-reviewed pattern exactly, so a direct security-focused
read-through was judged proportionate over an 8-angle fan-out:

- Confirmed the `up()` `WHERE` clause resolves to exactly one `(role, module)` pair.
- Confirmed the `ON CONFLICT` target matches the real partial unique index (verified by running it
  twice in a row — the second run stayed a no-op).
- Confirmed `down()` is scoped to the exact triple, not a blanket delete.
- Confirmed no application code changed — `PermissionGuard`/`@RequirePermission` untouched; this
  only makes an existing, already-audited check start succeeding for a second role on the same
  read action.
- Confirmed no SQL-injection surface — every value is a static literal.

**0 findings.** Not yet second-role human reviewed, gated, pushed, or merged — each remains a
separate, not-yet-requested next step, per this project's standing "no auto-merge" rule.
