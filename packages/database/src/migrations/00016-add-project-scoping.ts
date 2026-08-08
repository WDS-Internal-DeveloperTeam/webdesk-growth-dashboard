import { DataTypes, Op, type QueryInterface } from "sequelize";

/**
 * Completes the project-scoping axis (knowledge/12, task package §6/§7):
 * `role_permissions.project_id` already existed (migration 00011) but
 * `user_roles` had no equivalent column, and `role_permissions` had no
 * uniqueness guarantee for its project-scoped rows (only the global-scope
 * partial index from 00011). Neither column is FK-constrained — the
 * `projects` business entity doesn't exist yet (Task 8, explicitly out of
 * this phase's scope, per CLAUDE.md's own standing caution) — these are
 * schema-ready UUID slots only, exactly like `role_permissions.project_id`
 * already was. `AuthorizationService.can()` can still be exercised and
 * tested for real project-scoped behavior using arbitrary UUIDs in this
 * column, without a `projects` table existing — no real project row is
 * required for the column itself to correctly scope grants.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.addColumn("user_roles", "project_id", {
    type: DataTypes.UUID,
    allowNull: true,
  });

  // The original unique index (user_id, role_id) would incorrectly reject a
  // user holding the same role in two different projects — replace it with
  // two partial indexes, mirroring role_permissions' own global/scoped split.
  await context.removeIndex("user_roles", "user_roles_user_role_unique");
  await context.addIndex("user_roles", ["user_id", "role_id"], {
    unique: true,
    where: { project_id: null },
    name: "user_roles_global_scope_unique",
  });
  await context.addIndex("user_roles", ["user_id", "role_id", "project_id"], {
    unique: true,
    where: { project_id: { [Op.ne]: null } },
    name: "user_roles_project_scope_unique",
  });

  await context.addIndex("role_permissions", ["role_id", "module_id", "action", "project_id"], {
    unique: true,
    where: { project_id: { [Op.ne]: null } },
    name: "role_permissions_project_scope_unique",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.removeIndex("role_permissions", "role_permissions_project_scope_unique");
  await context.removeIndex("user_roles", "user_roles_project_scope_unique");
  await context.removeIndex("user_roles", "user_roles_global_scope_unique");
  await context.addIndex("user_roles", ["user_id", "role_id"], {
    unique: true,
    name: "user_roles_user_role_unique",
  });
  await context.removeColumn("user_roles", "project_id");
}
