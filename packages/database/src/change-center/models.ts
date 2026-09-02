import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface ChangeCenterModels {
  readonly ChangeRecord: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, ChangeCenterModels>();

const CATEGORY_VALUES = [
  "theme",
  "plugin",
  "core",
  "database",
  "integration",
  "seo_metadata",
  "analytics_tracking",
  "security",
  "accessibility",
  "performance",
  "redirects_urls",
  "assets",
  "conflicts_failed_sync",
  "rollback_history",
] as const;

const STATUS_VALUES = [
  "detected",
  "under_review",
  "accepted",
  "rejected",
  "deferred",
  "manual_merge_required",
  "applying",
  "applied",
  "verified",
  "apply_failed",
] as const;

export function getChangeCenterModels(sequelize: Sequelize = getConnection()): ChangeCenterModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const ChangeRecord = sequelize.define(
    "ChangeRecord",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      category: { type: DataTypes.ENUM(...CATEGORY_VALUES), allowNull: false },
      severity: {
        type: DataTypes.ENUM("critical", "high", "medium", "low", "info"),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(...STATUS_VALUES),
        allowNull: false,
        defaultValue: "detected",
      },
      scanFindingId: { type: DataTypes.UUID, allowNull: true },
      source: { type: DataTypes.STRING(255), allowNull: true },
      targetModuleKey: { type: DataTypes.STRING(64), allowNull: true },
      targetId: { type: DataTypes.UUID, allowNull: true },
      recordLabel: { type: DataTypes.STRING(500), allowNull: false },
      beforeValue: { type: DataTypes.TEXT, allowNull: true },
      afterValue: { type: DataTypes.TEXT, allowNull: true },
      confidence: { type: DataTypes.INTEGER, allowNull: true },
      recommendation: { type: DataTypes.TEXT, allowNull: true },
      assignedToUserId: { type: DataTypes.UUID, allowNull: true },
      decisionNotes: { type: DataTypes.TEXT, allowNull: true },
      decidedByUserId: { type: DataTypes.UUID, allowNull: true },
      decidedAt: { type: DataTypes.DATE, allowNull: true },
      appliedByUserId: { type: DataTypes.UUID, allowNull: true },
      appliedAt: { type: DataTypes.DATE, allowNull: true },
      verifiedByUserId: { type: DataTypes.UUID, allowNull: true },
      verifiedAt: { type: DataTypes.DATE, allowNull: true },
      rollbackGuidance: { type: DataTypes.TEXT, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "change_records", underscored: true, timestamps: true },
  );

  const models: ChangeCenterModels = { ChangeRecord };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors `scan-center/models.ts`'s own `resetScanCenterModelsForTests`. */
export function resetChangeCenterModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
