import type { QueryInterface } from "sequelize";

/**
 * Real backend business functionality now exists for `business_knowledge_center` (schema, API,
 * RBAC, tested — `docs/task-packages/module-business-knowledge-center.md`) — same pattern as
 * `00044-mark-projects-in-development.ts`. `in_development`, not `available`: no
 * `dashboard-web` UI exists yet, and this hasn't been through independent code/security review or
 * a gate decision yet.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET implementation_status = 'in_development', last_reviewed_at = now() WHERE key = 'business_knowledge_center';`,
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET implementation_status = 'not_started' WHERE key = 'business_knowledge_center';`,
  );
}
