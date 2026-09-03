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
