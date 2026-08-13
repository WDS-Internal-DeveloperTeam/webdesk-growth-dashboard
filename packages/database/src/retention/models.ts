import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface RetentionModels {
  readonly RetentionPolicy: ModelStatic<Model>;
  readonly RetentionHold: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, RetentionModels>();

export function getRetentionModels(sequelize: Sequelize = getConnection()): RetentionModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const RetentionPolicy = sequelize.define(
    "RetentionPolicy",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      categoryKey: { type: DataTypes.STRING(64), allowNull: false },
      displayName: { type: DataTypes.STRING(255), allowNull: false },
      retentionValue: { type: DataTypes.INTEGER, allowNull: false },
      retentionUnit: { type: DataTypes.ENUM("days", "years"), allowNull: false },
      anchor: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "created_at" },
      description: { type: DataTypes.TEXT, allowNull: true },
      appliesToEntityType: { type: DataTypes.STRING(64), allowNull: true },
    },
    {
      tableName: "retention_policies",
      underscored: true,
      timestamps: true,
    },
  );

  const RetentionHold = sequelize.define(
    "RetentionHold",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      scope: { type: DataTypes.ENUM("entity", "category"), allowNull: false },
      resourceType: { type: DataTypes.STRING(64), allowNull: true },
      resourceId: { type: DataTypes.STRING(128), allowNull: true },
      categoryKey: { type: DataTypes.STRING(64), allowNull: true },
      reasonCategory: { type: DataTypes.STRING(64), allowNull: false },
      reason: { type: DataTypes.TEXT, allowNull: false },
      createdByUserId: { type: DataTypes.UUID, allowNull: false },
      approvedByUserId: { type: DataTypes.UUID, allowNull: true },
      startDate: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      endDate: { type: DataTypes.DATE, allowNull: true },
      status: {
        type: DataTypes.ENUM("active", "released"),
        allowNull: false,
        defaultValue: "active",
      },
      releaseReason: { type: DataTypes.TEXT, allowNull: true },
      releasedByUserId: { type: DataTypes.UUID, allowNull: true },
      releasedAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "retention_holds",
      underscored: true,
      timestamps: true,
    },
  );

  const models: RetentionModels = { RetentionPolicy, RetentionHold };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests`. */
export function resetRetentionModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
