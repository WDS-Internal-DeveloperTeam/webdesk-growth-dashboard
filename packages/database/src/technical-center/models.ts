import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface TechnicalCenterModels {
  readonly TechnicalCheckDefinition: ModelStatic<Model>;
  readonly TechnicalCheckRun: ModelStatic<Model>;
  readonly TechnicalFinding: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, TechnicalCenterModels>();

const TECHNICAL_CHECK_TYPE_VALUES = [
  "coding_standards",
  "linting",
  "automated_tests",
  "coverage",
  "dependency_vulnerability",
  "wordpress_compatibility",
  "php_compatibility",
  "code_review",
  "security",
  "accessibility",
  "performance",
  "browser_compatibility",
  "visual_regression",
] as const;

export function getTechnicalCenterModels(
  sequelize: Sequelize = getConnection(),
): TechnicalCenterModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const TechnicalCheckDefinition = sequelize.define(
    "TechnicalCheckDefinition",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      checkType: { type: DataTypes.ENUM(...TECHNICAL_CHECK_TYPE_VALUES), allowNull: false },
      mode: {
        type: DataTypes.ENUM("manual", "scheduled"),
        allowNull: false,
        defaultValue: "manual",
      },
      target: { type: DataTypes.TEXT, allowNull: true },
      environment: { type: DataTypes.STRING(255), allowNull: true },
      scheduleCron: { type: DataTypes.STRING(255), allowNull: true },
      isEnabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "technical_check_definitions", underscored: true, timestamps: true },
  );

  const TechnicalCheckRun = sequelize.define(
    "TechnicalCheckRun",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      technicalCheckDefinitionId: { type: DataTypes.UUID, allowNull: false },
      status: {
        type: DataTypes.ENUM(
          "requested",
          "queued",
          "running",
          "completed",
          "partially_completed",
          "failed",
          "timed_out",
          "cancelled",
        ),
        allowNull: false,
        defaultValue: "requested",
      },
      triggerType: { type: DataTypes.ENUM("manual", "scheduled"), allowNull: false },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      errorSummary: { type: DataTypes.TEXT, allowNull: true },
      requestedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "technical_check_runs", underscored: true, timestamps: true },
  );

  const TechnicalFinding = sequelize.define(
    "TechnicalFinding",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      technicalCheckRunId: { type: DataTypes.UUID, allowNull: false },
      category: { type: DataTypes.STRING(255), allowNull: true },
      severity: {
        type: DataTypes.ENUM("critical", "high", "medium", "low", "info"),
        allowNull: false,
      },
      title: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      location: { type: DataTypes.STRING(500), allowNull: true },
      status: {
        type: DataTypes.ENUM("open", "acknowledged", "resolved", "dismissed"),
        allowNull: false,
        defaultValue: "open",
      },
      resolvedBy: { type: DataTypes.UUID, allowNull: true },
      resolvedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: "technical_findings", underscored: true, timestamps: true },
  );

  const models: TechnicalCenterModels = {
    TechnicalCheckDefinition,
    TechnicalCheckRun,
    TechnicalFinding,
  };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors `scan-center/models.ts`'s own
 *  `resetScanCenterModelsForTests`. */
export function resetTechnicalCenterModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
