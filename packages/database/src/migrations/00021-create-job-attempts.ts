import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Job attempt history (brief §10) — "do not store only the latest attempt."
 * One row per execution attempt of a `jobs` row; `jobs.attempt_count` is the
 * running total, this table is the full history behind it.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("job_attempts", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    job_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "jobs", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    attempt_number: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    finished_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    handler: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    result: {
      type: DataTypes.STRING(16),
      allowNull: true,
    },
    failure_category: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    failure_summary: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    retry_decision: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    correlation_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    /** A reference (e.g. a Sentry event URL/ID), never full logs duplicated into Postgres — §10's "store references where appropriate." */
    evidence_reference: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await context.addConstraint("job_attempts", {
    fields: ["job_id", "attempt_number"],
    type: "unique",
    name: "job_attempts_job_id_attempt_number_unique",
  });
  await context.addIndex("job_attempts", ["job_id"], { name: "job_attempts_job_id_idx" });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("job_attempts", {});
}
