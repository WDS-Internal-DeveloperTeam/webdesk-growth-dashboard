import { type QueryInterface } from "sequelize";

/**
 * `user_roles`' two existing indexes (migration `00016`) both lead with `user_id` —
 * `(user_id, role_id)` and `(user_id, role_id, project_id)` — because every query up to this point
 * resolved "what roles does this user hold." `UserRoleRepository.findUserIdsForRoleInProject()`
 * (the Projects module's "list current approvers" endpoint, `module-projects-backend-closeout`
 * branch) is the first query to invert that: "which users hold this role in this project" —
 * `WHERE role_id = ? AND project_id = ?`, with no `user_id` predicate, so neither existing index
 * is usable and the query falls back to a full table scan (code-review finding, this branch).
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.addIndex("user_roles", ["role_id", "project_id"], {
    name: "user_roles_role_project_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.removeIndex("user_roles", "user_roles_role_project_idx");
}
