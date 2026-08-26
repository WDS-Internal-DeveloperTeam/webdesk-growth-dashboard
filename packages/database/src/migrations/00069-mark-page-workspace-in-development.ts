import type { QueryInterface } from "sequelize";

/**
 * Real backend business functionality now exists for `page_workspace` (schema, API, RBAC,
 * tested — same pattern as `00067-mark-review-and-approval-center-in-development.ts`).
 * `in_development`, not `available`: no `dashboard-web` UI exists yet (task package §1,
 * backend-only pass), the deferred `page_relationships`/`page_component_usage`/`page_deployments`
 * tables are still out of scope (D1), and this hasn't been through independent code/security
 * review or a gate decision yet.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET implementation_status = 'in_development', last_reviewed_at = now() WHERE key = 'page_workspace';`,
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET implementation_status = 'not_started' WHERE key = 'page_workspace';`,
  );
}
