import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface ImportAndExportCenterModels {
  readonly ImportTemplate: ModelStatic<Model>;
  readonly ImportRun: ModelStatic<Model>;
  readonly ImportRow: ModelStatic<Model>;
  readonly ImportError: ModelStatic<Model>;
  readonly ExportRun: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, ImportAndExportCenterModels>();

const DUPLICATE_STRATEGY_VALUES = ["skip", "overwrite", "create_new"] as const;
const FILE_FORMAT_VALUES = ["csv", "xlsx", "json"] as const;

export function getImportAndExportCenterModels(
  sequelize: Sequelize = getConnection(),
): ImportAndExportCenterModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const ImportTemplate = sequelize.define(
    "ImportTemplate",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      targetModuleKey: { type: DataTypes.STRING(100), allowNull: false },
      columnMapping: { type: DataTypes.JSONB, allowNull: true },
      duplicateStrategyDefault: {
        type: DataTypes.ENUM(...DUPLICATE_STRATEGY_VALUES),
        allowNull: false,
        defaultValue: "skip",
      },
      fileFormat: { type: DataTypes.ENUM(...FILE_FORMAT_VALUES), allowNull: false },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "import_templates", underscored: true, timestamps: true },
  );

  const ImportRun = sequelize.define(
    "ImportRun",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      importTemplateId: { type: DataTypes.UUID, allowNull: false },
      templateVersion: { type: DataTypes.INTEGER, allowNull: false },
      isDryRun: { type: DataTypes.BOOLEAN, allowNull: false },
      duplicateStrategy: { type: DataTypes.ENUM(...DUPLICATE_STRATEGY_VALUES), allowNull: true },
      sourceFileReference: { type: DataTypes.TEXT, allowNull: true },
      sourceChecksum: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM(
          "draft",
          "submitted",
          "approved",
          "validating",
          "dry_run_completed",
          "importing",
          "completed",
          "partially_completed",
          "failed",
          "cancelled",
          "rejected",
          "rolled_back",
        ),
        allowNull: false,
        defaultValue: "draft",
      },
      totalRows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      successCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      errorCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      skippedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      errorSummary: { type: DataTypes.TEXT, allowNull: true },
      rollbackNotes: { type: DataTypes.TEXT, allowNull: true },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      requestedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "import_runs", underscored: true, timestamps: true },
  );

  const ImportRow = sequelize.define(
    "ImportRow",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      importRunId: { type: DataTypes.UUID, allowNull: false },
      rowNumber: { type: DataTypes.INTEGER, allowNull: false },
      externalId: { type: DataTypes.TEXT, allowNull: true },
      rawData: { type: DataTypes.JSONB, allowNull: true },
      status: {
        type: DataTypes.ENUM("pending", "valid", "invalid", "imported", "skipped", "failed"),
        allowNull: false,
        defaultValue: "pending",
      },
      resolution: {
        type: DataTypes.ENUM("created", "overwritten", "skipped_duplicate"),
        allowNull: true,
      },
    },
    { tableName: "import_rows", underscored: true, timestamps: true },
  );

  const ImportError = sequelize.define(
    "ImportError",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      importRunId: { type: DataTypes.UUID, allowNull: false },
      importRowId: { type: DataTypes.UUID, allowNull: true },
      errorCode: { type: DataTypes.TEXT, allowNull: true },
      message: { type: DataTypes.TEXT, allowNull: false },
      fieldName: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: "import_errors", underscored: true, timestamps: true, updatedAt: false },
  );

  const ExportRun = sequelize.define(
    "ExportRun",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      targetModuleKey: { type: DataTypes.STRING(100), allowNull: false },
      filterCriteria: { type: DataTypes.JSONB, allowNull: true },
      format: { type: DataTypes.ENUM(...FILE_FORMAT_VALUES), allowNull: false },
      status: {
        type: DataTypes.ENUM("requested", "processing", "completed", "failed", "cancelled"),
        allowNull: false,
        defaultValue: "requested",
      },
      rowCount: { type: DataTypes.INTEGER, allowNull: true },
      fileReference: { type: DataTypes.TEXT, allowNull: true },
      excludesConfidentialFields: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      errorSummary: { type: DataTypes.TEXT, allowNull: true },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      requestedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "export_runs", underscored: true, timestamps: true },
  );

  const models: ImportAndExportCenterModels = {
    ImportTemplate,
    ImportRun,
    ImportRow,
    ImportError,
    ExportRun,
  };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors `scan-center/models.ts`'s own `resetScanCenterModelsForTests`. */
export function resetImportAndExportCenterModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
