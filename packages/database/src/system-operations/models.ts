import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface SystemOperationsModels {
  readonly SystemEvent: ModelStatic<Model>;
  readonly SystemComponent: ModelStatic<Model>;
  readonly SystemHealthCheck: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, SystemOperationsModels>();

export function getSystemOperationsModels(
  sequelize: Sequelize = getConnection(),
): SystemOperationsModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const SystemEvent = sequelize.define(
    "SystemEvent",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      eventType: { type: DataTypes.STRING(64), allowNull: false },
      category: { type: DataTypes.STRING(64), allowNull: true },
      severity: {
        type: DataTypes.ENUM("critical", "high", "medium", "low"),
        allowNull: true,
      },
      sourceApplication: { type: DataTypes.STRING(64), allowNull: true },
      relatedEntityType: { type: DataTypes.STRING(32), allowNull: true },
      relatedEntityId: { type: DataTypes.STRING(128), allowNull: true },
      correlationId: { type: DataTypes.UUID, allowNull: true },
      message: { type: DataTypes.TEXT, allowNull: false },
      metadata: { type: DataTypes.JSONB, allowNull: true },
      relatedAuditEventId: { type: DataTypes.UUID, allowNull: true },
    },
    {
      tableName: "system_events",
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );

  const SystemComponent = sequelize.define(
    "SystemComponent",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      key: { type: DataTypes.STRING(64), allowNull: false },
      displayName: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "system_components",
      underscored: true,
      timestamps: true,
    },
  );

  const SystemHealthCheck = sequelize.define(
    "SystemHealthCheck",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      componentKey: { type: DataTypes.STRING(64), allowNull: false },
      status: {
        type: DataTypes.ENUM("unknown", "healthy", "degraded", "unavailable", "not_configured"),
        allowNull: false,
      },
      detail: { type: DataTypes.TEXT, allowNull: true },
      checkedByUserId: { type: DataTypes.UUID, allowNull: true },
      source: { type: DataTypes.STRING(64), allowNull: false, defaultValue: "manual" },
      correlationId: { type: DataTypes.UUID, allowNull: true },
    },
    {
      tableName: "system_health_checks",
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );

  const models: SystemOperationsModels = { SystemEvent, SystemComponent, SystemHealthCheck };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests`. */
export function resetSystemOperationsModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
