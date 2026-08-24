import type { QueryInterface } from "sequelize";

/**
 * Real backend business functionality now exists for `keyword_and_entity_library` (schema, API,
 * RBAC, tested — same pattern as `00057-mark-website-strategy-center-in-development.ts`/
 * `00059-mark-page-inventory-in-development.ts`). `in_development`, not `available`: no
 * `dashboard-web` UI exists yet, and this hasn't been through independent code/security review or
 * a gate decision yet.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET implementation_status = 'in_development', last_reviewed_at = now() WHERE key = 'keyword_and_entity_library';`,
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET implementation_status = 'not_started' WHERE key = 'keyword_and_entity_library';`,
  );
}
