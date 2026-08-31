import type { QueryInterface } from "sequelize";

/**
 * Real backend business functionality now exists for `page_template_library` (schema, API, RBAC,
 * tested — same pattern as `00081-mark-section-and-pattern-library-in-development.ts`/
 * `00079-mark-component-library-in-development.ts`). `in_development`, not `available`: no
 * `dashboard-web` UI exists yet (backend-only pass), and this hasn't been through independent
 * code/security review or a gate decision yet.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET implementation_status = 'in_development', last_reviewed_at = now() WHERE key = 'page_template_library';`,
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET implementation_status = 'not_started' WHERE key = 'page_template_library';`,
  );
}
