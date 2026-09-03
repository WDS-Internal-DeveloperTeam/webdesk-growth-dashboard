import type { QueryInterface } from "sequelize";

/**
 * Supports the Decision and Activity Log module's own primary query shape —
 * `WHERE event_type IN (...) ORDER BY created_at DESC` — against `audit_events` (migration
 * `00018`). That table already has a single-column index on `event_type` (`00018`) and one on
 * `created_at` (`00018`) plus a composite `(project_id, created_at)` index (`00019`), but no
 * composite covering `event_type` alongside `created_at`, so a multi-value `event_type IN (...)`
 * filter combined with the default `created_at DESC` ordering would otherwise fall back to a
 * less efficient plan (an index scan on `event_type` followed by a sort, or a sequential scan) as
 * the table grows. `docs/implementation/module-decision-and-activity-log.md` records the full
 * account.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.addIndex("audit_events", ["event_type", "created_at"], {
    name: "audit_events_event_type_created_at_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.removeIndex("audit_events", "audit_events_event_type_created_at_idx");
}
