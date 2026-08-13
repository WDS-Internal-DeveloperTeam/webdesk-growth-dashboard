import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Append-only health-status observation history (Phase 1E system-events-
 * health brief §25) — one row per check, never updated or upserted. The
 * "current" status for a component is resolved by the service layer as
 * the most recent row (`ORDER BY created_at DESC LIMIT 1`), or an honest
 * synthetic `"unknown"` when no row exists at all — see
 * `SystemHealthService.getCurrentStatus()`.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("system_health_checks", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    component_key: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: "system_components", key: "key" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    status: {
      type: DataTypes.ENUM("unknown", "healthy", "degraded", "unavailable", "not_configured"),
      allowNull: false,
    },
    detail: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** Real system user, when a human manually triggered the check via the HTTP endpoint (the only path that exists in this slice). Null for a future system-initiated probe. */
    checked_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    /** e.g. "manual", "scheduled_probe" — evolvable STRING describing what triggered this check, not just who. */
    source: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: "manual",
    },
    correlation_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await context.addIndex("system_health_checks", ["component_key", "created_at"], {
    name: "system_health_checks_component_key_created_at_idx",
  });
  await context.addIndex("system_health_checks", ["status"], {
    name: "system_health_checks_status_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("system_health_checks", {});
  await context.sequelize.query(`DROP TYPE IF EXISTS "enum_system_health_checks_status";`);
}
