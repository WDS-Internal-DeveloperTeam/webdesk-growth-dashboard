import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The reusable operational-job model (Phase 1E job-architecture brief §9) —
 * every future background operation (scans, imports, exports, releases,
 * etc.) creates a row here rather than inventing its own job-status table
 * (§4's core rule: "future modules must reuse the Phase 1E infrastructure").
 * No real producer exists yet — this proves the domain model the same way
 * Phase 1D's "Users/roles" HTTP surface proved `PermissionGuard` before any
 * of the other 20 business modules existed as code.
 *
 * `status` is a real Postgres ENUM, unlike `event_type` on `audit_events` —
 * §9 gives an exact, small, "use exact names" lifecycle, the same
 * "small, structurally stable set" reasoning that made `audit_events.actor_type`
 * an ENUM while `audit_events.event_type` stayed an evolvable STRING.
 * `job_type`, `cancellation_state`, and `failure_category` stay STRING for
 * the same "vocabulary expected to grow" reason `event_type` did.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("jobs", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    job_type: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    /** Not FK-constrained — no `projects` table exists yet, same precedent as `user_roles.project_id` (migration 00016). */
    project_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    resource_type: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    resource_id: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    requested_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    status: {
      type: DataTypes.ENUM(
        "pending",
        "queued",
        "running",
        "retrying",
        "succeeded",
        "failed",
        "cancelled",
        "expired",
      ),
      allowNull: false,
      defaultValue: "pending",
    },
    progress: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    current_step: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    /** Scoped with `idempotency_keys.scope` (`"job:" + job_type`) — this column alone is not globally unique. */
    idempotency_key: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    retry_policy: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    attempt_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    max_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    timeout_seconds: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    scheduled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    finished_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    heartbeat_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancellation_state: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    failure_code: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    failure_category: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    /** Safe summary only — never a raw stack trace or secret; full diagnostics live in Sentry/logs, referenced (not duplicated) from `job_attempts.evidence_reference`. */
    failure_summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    next_retry_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    worker_identity: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    correlation_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    retention_category: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await context.sequelize.query(
    `ALTER TABLE jobs ADD CONSTRAINT jobs_progress_range CHECK (progress IS NULL OR (progress >= 0 AND progress <= 100));`,
  );

  await context.addIndex("jobs", ["status"], { name: "jobs_status_idx" });
  await context.addIndex("jobs", ["project_id", "created_at"], {
    name: "jobs_project_id_created_at_idx",
  });
  await context.addIndex("jobs", ["job_type"], { name: "jobs_job_type_idx" });
  await context.addIndex("jobs", ["correlation_id"], { name: "jobs_correlation_id_idx" });
  await context.addIndex("jobs", ["next_retry_at"], { name: "jobs_next_retry_at_idx" });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("jobs", {});
  await context.sequelize.query(`DROP TYPE IF EXISTS "enum_jobs_status";`);
}
