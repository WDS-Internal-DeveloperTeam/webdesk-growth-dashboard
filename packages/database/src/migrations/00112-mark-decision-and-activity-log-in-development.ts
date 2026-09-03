import type { QueryInterface } from "sequelize";

/**
 * Real backend business functionality now exists for `decision_and_activity_log` (a read-only
 * HTTP query surface over the existing `audit_events` table, gated on `system_settings`, tested —
 * same pattern as `00110-mark-technical-center-in-development.ts`). `in_development`, not
 * `available`: no `dashboard-web` UI exists yet, and this hasn't been through independent
 * code/security review or a gate decision yet.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET implementation_status = 'in_development', last_reviewed_at = now() WHERE key = 'decision_and_activity_log';`,
  );
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.sequelize.query(
    `UPDATE module_registry SET implementation_status = 'not_started' WHERE key = 'decision_and_activity_log';`,
  );
}
