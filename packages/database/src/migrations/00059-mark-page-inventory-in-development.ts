import type { QueryInterface } from "sequelize";

/**
 * Real backend business functionality now exists for `page_inventory` (schema, API, RBAC, tested —
 * same pattern as `00044-mark-projects-in-development.ts`/
 * `00048-mark-business-knowledge-center-in-development.ts`/
 * `00051-mark-service-library-in-development.ts`/`00053-mark-persona-library-in-development.ts`/
 * `00055-mark-proof-and-claims-library-in-development.ts`/
 * `00057-mark-website-strategy-center-in-development.ts`). `in_development`, not `available`: no
 * `dashboard-web` UI exists yet, and this hasn't been through independent code/security review or
 * a gate decision yet.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET implementation_status = 'in_development', last_reviewed_at = now() WHERE key = 'page_inventory';`,
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET implementation_status = 'not_started' WHERE key = 'page_inventory';`,
  );
}
