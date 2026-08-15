import type { QueryInterface } from "sequelize";

/**
 * Real backend business functionality now exists for `projects` (schema, API, RBAC, audit
 * wiring, tested — `docs/task-packages/module-projects-foundation.md`) — the first module_registry
 * row ever updated past its Phase 1F seed value. `in_development`, not `available`: no UI exists
 * yet (D7, deferred), and this hasn't been through independent code/security review or a gate
 * decision yet — per the registry's own controlled-vocabulary caution against overclaiming
 * `available` before real, reviewed, complete functionality exists.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET implementation_status = 'in_development', last_reviewed_at = now() WHERE key = 'projects';`,
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET implementation_status = 'not_started' WHERE key = 'projects';`,
  );
}
