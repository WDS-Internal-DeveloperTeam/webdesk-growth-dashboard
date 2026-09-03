import type { QueryInterface } from "sequelize";

/**
 * Grants `super_admin` the `notifications_view` action on the `system_settings` module.
 *
 * `notifications_view`/`notifications_configure` are bespoke action strings outside
 * `00013-seed-rbac-matrix.ts`'s own letter-code vocabulary (§29's own example pair,
 * `apps/dashboard-api/src/notifications/notifications.controller.ts`'s own doc comment) —
 * deliberately left zero-seeded when the Notification Center backend/UI were built, per
 * `docs/implementation/dashboard-web-notification-center.md`'s own flagged, declined-scope gap.
 * Requested directly ("Grant a role notifications_view permission"); `super_admin` chosen
 * (`AskUserQuestion`) since it already holds every other `system_settings` action (`VCERM`) and
 * is the role the currently-provisioned production user (Super Admin) holds. `notifications_configure`
 * stays zero-seeded — out of scope for this request.
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
    WHERE roles.key = 'super_admin' AND modules.key = 'system_settings'
    ON CONFLICT (role_id, module_id, action) WHERE project_id IS NULL DO NOTHING;
  `);
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(`
    DELETE FROM role_permissions
    USING roles, modules
    WHERE role_permissions.role_id = roles.id
      AND role_permissions.module_id = modules.id
      AND roles.key = 'super_admin'
      AND modules.key = 'system_settings'
      AND role_permissions.action = 'notifications_view';
  `);
}
