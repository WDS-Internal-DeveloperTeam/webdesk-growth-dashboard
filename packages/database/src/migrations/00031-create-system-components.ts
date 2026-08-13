import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The system-component catalog (Phase 1E system-events-health brief §25)
 * — seeded by the next migration with the real, already-approved 10
 * subsystems §25 names explicitly. Same "the catalog is approved, seed
 * it" treatment `retention_policies`/`incident_severity_policies` got for
 * their own approved lists — individual health *readings*
 * (`system_health_checks`) are never seeded, since status is observed,
 * not decided.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("system_components", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    display_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
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

  await context.addConstraint("system_components", {
    fields: ["key"],
    type: "unique",
    name: "system_components_key_unique",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("system_components", {});
}
