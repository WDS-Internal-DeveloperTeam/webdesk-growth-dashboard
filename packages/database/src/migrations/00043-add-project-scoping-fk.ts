import { type QueryInterface } from "sequelize";

/**
 * The first real target for the project-scoping columns Phase 1D-expanded built schema-ready but
 * unconstrained: `user_roles.project_id` (migration `00016`) and `role_permissions.project_id`
 * (migration `00011`). Both existed for a real, already-tested purpose
 * (`AuthorizationService.evaluate()`'s project-aware role/grant resolution) but had no FK target
 * since no `projects` table existed. Zero existing rows use a real `project_id` today — this
 * project's only project-scoped grants were exercised in tests against arbitrary UUIDs — so this
 * is a safe, no-backfill schema change (task package §22).
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.addConstraint("user_roles", {
    fields: ["project_id"],
    type: "foreign key",
    name: "user_roles_project_id_fkey",
    references: { table: "projects", field: "id" },
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
  await context.addConstraint("role_permissions", {
    fields: ["project_id"],
    type: "foreign key",
    name: "role_permissions_project_id_fkey",
    references: { table: "projects", field: "id" },
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.removeConstraint("role_permissions", "role_permissions_project_id_fkey");
  await context.removeConstraint("user_roles", "user_roles_project_id_fkey");
}
