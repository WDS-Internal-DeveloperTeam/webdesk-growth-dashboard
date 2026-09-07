import type { QueryInterface } from "sequelize";

/**
 * Grants `owner_growth_approver` the `notifications_view` action on the `system_settings`
 * module — the second of the module's two currently-widened roles, alongside `super_admin`
 * (migration `00117-grant-notifications-view-to-super-admin.ts`).
 *
 * `notifications_view`/`notifications_configure` are bespoke action strings outside
 * `00013-seed-rbac-matrix.ts`'s own letter-code vocabulary — deliberately left zero-seeded
 * when the Notification Center backend/UI were built, per
 * `docs/implementation/dashboard-web-notification-center.md`'s own flagged, declined-scope gap.
 * Requested directly ("start whatever missing in the notification center" → "widen
 * notifications_view RBAC grant"); `owner_growth_approver` chosen (`AskUserQuestion`) since it
 * already holds nearly every other `system_settings` action alongside `super_admin`.
 * `notifications_configure` stays zero-seeded for every role — out of scope for this request.
 *
 * `ON CONFLICT ... DO NOTHING` against the real partial unique index
 * (`role_permissions_global_scope_unique`, `(role_id, module_id, action) WHERE project_id IS NULL`)
 * makes this migration safely re-runnable rather than failing on a duplicate grant.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(`
    INSERT INTO role_permissions (id, role_id, module_id, action, created_at, updated_at)
    SELECT
      gen_random_uuid(),
      roles.id,
      modules.id,
      'notifications_view',
      now(),
      now()
    FROM roles, modules
    WHERE roles.key = 'owner_growth_approver' AND modules.key = 'system_settings'
    ON CONFLICT (role_id, module_id, action) WHERE project_id IS NULL DO NOTHING;
  `);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(`
    DELETE FROM role_permissions
    USING roles, modules
    WHERE role_permissions.role_id = roles.id
      AND role_permissions.module_id = modules.id
      AND roles.key = 'owner_growth_approver'
      AND modules.key = 'system_settings'
      AND role_permissions.action = 'notifications_view';
  `);
}
