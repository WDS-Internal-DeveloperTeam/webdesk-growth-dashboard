import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The incident-severity response-target model (Phase 1E operational-
 * contacts brief §18). Seeded by the next migration with the real,
 * already-approved four-severity matrix — same "these numbers are
 * already decided" reasoning `retention_policies` used for §20's matrix.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("incident_severity_policies", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    severity: {
      type: DataTypes.ENUM("critical", "high", "medium", "low"),
      allowNull: false,
    },
    /** Null for a non-fixed-duration target (e.g. "low" — see `is_fixed_duration`). */
    response_target_value: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    response_target_unit: {
      type: DataTypes.ENUM("minutes", "hours", "business_days"),
      allowNull: true,
    },
    /** Always present — the human-readable target, even when it's not a fixed duration (e.g. "Scheduled maintenance"). */
    response_target_description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    is_fixed_duration: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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

  await context.addConstraint("incident_severity_policies", {
    fields: ["severity"],
    type: "unique",
    name: "incident_severity_policies_severity_unique",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("incident_severity_policies", {});
  await context.sequelize.query(`DROP TYPE IF EXISTS "enum_incident_severity_policies_severity";`);
  await context.sequelize.query(
    `DROP TYPE IF EXISTS "enum_incident_severity_policies_response_target_unit";`,
  );
}
