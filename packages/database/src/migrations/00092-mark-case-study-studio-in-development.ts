import type { QueryInterface } from "sequelize";

/**
 * Real backend business functionality now exists for `case_study_studio` (schema, API, RBAC,
 * tested — same pattern as `00051-mark-service-library-in-development.ts`/
 * `00053-mark-persona-library-in-development.ts`/
 * `00055-mark-proof-and-claims-library-in-development.ts`). `in_development`, not `available`: no
 * `dashboard-web` UI exists yet (D10), and this hasn't been through independent code/security
 * review or a gate decision yet.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET implementation_status = 'in_development', last_reviewed_at = now() WHERE key = 'case_study_studio';`,
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET implementation_status = 'not_started' WHERE key = 'case_study_studio';`,
  );
}
