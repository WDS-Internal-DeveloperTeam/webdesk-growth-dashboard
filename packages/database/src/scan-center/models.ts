import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface ScanCenterModels {
  readonly ScanDefinition: ModelStatic<Model>;
  readonly ScanRun: ModelStatic<Model>;
  readonly ScanFinding: ModelStatic<Model>;
  readonly ScanEvidence: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, ScanCenterModels>();

const SCAN_TYPE_VALUES = [
  "full_website",
  "selected_page",
  "repository",
  "wordpress_health",
  "theme_plugin_core_currency",
  "security_indicators",
  "accessibility",
  "performance",
  "links",
  "metadata",
  "structured_data",
] as const;

export function getScanCenterModels(sequelize: Sequelize = getConnection()): ScanCenterModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const ScanDefinition = sequelize.define(
    "ScanDefinition",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      scanType: { type: DataTypes.ENUM(...SCAN_TYPE_VALUES), allowNull: false },
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
    { tableName: "scan_definitions", underscored: true, timestamps: true },
  );

  const ScanRun = sequelize.define(
    "ScanRun",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      scanDefinitionId: { type: DataTypes.UUID, allowNull: false },
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
    { tableName: "scan_runs", underscored: true, timestamps: true },
  );

  const ScanFinding = sequelize.define(
    "ScanFinding",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      scanRunId: { type: DataTypes.UUID, allowNull: false },
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
    { tableName: "scan_findings", underscored: true, timestamps: true },
  );

  const ScanEvidence = sequelize.define(
    "ScanEvidence",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      scanFindingId: { type: DataTypes.UUID, allowNull: false },
      evidenceType: { type: DataTypes.STRING(100), allowNull: true },
      reference: { type: DataTypes.TEXT, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      capturedAt: { type: DataTypes.DATE, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "scan_evidence", underscored: true, timestamps: true },
  );

  const models: ScanCenterModels = { ScanDefinition, ScanRun, ScanFinding, ScanEvidence };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors `internal-linking-library/models.ts`'s own
 *  `resetInternalLinkingLibraryModelsForTests`. */
export function resetScanCenterModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
