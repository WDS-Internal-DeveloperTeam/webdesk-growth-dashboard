import type { QueryInterface } from "sequelize";

/**
 * Real backend business functionality now exists for `ready_for_claude_queue` (schema, API, RBAC,
 * tested — same pattern as `00098-mark-knowledge-library-in-development.ts`). `in_development`,
 * not `available`: no `dashboard-web` UI exists yet (D8), and this hasn't been through independent
 * code/security review or a gate decision yet.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET implementation_status = 'in_development', last_reviewed_at = now() WHERE key = 'ready_for_claude_queue';`,
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET implementation_status = 'not_started' WHERE key = 'ready_for_claude_queue';`,
  );
}
