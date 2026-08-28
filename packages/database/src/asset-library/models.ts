import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface AssetLibraryModels {
  readonly Asset: ModelStatic<Model>;
  readonly AssetRelatedRecord: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, AssetLibraryModels>();

export function getAssetLibraryModels(sequelize: Sequelize = getConnection()): AssetLibraryModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const Asset = sequelize.define(
    "Asset",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      title: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      fileReference: { type: DataTypes.STRING(2048), allowNull: true },
      mimeType: { type: DataTypes.STRING(255), allowNull: true },
      fileSizeBytes: { type: DataTypes.BIGINT, allowNull: true },
      checksum: { type: DataTypes.STRING(128), allowNull: true },
      widthPx: { type: DataTypes.INTEGER, allowNull: true },
      heightPx: { type: DataTypes.INTEGER, allowNull: true },
      durationSeconds: { type: DataTypes.INTEGER, allowNull: true },
      licence: { type: DataTypes.TEXT, allowNull: true },
      licenceHolder: { type: DataTypes.STRING(255), allowNull: true },
      consentReference: { type: DataTypes.TEXT, allowNull: true },
      altTextGuidance: { type: DataTypes.TEXT, allowNull: true },
      visibility: {
        type: DataTypes.ENUM("public", "internal", "restricted"),
        allowNull: false,
        defaultValue: "internal",
      },
      retentionNote: { type: DataTypes.TEXT, allowNull: true },
      scanStatus: {
        type: DataTypes.ENUM("not_configured", "pending", "clean", "infected", "failed"),
        allowNull: false,
        defaultValue: "not_configured",
      },
      approvalStatus: {
        type: DataTypes.ENUM(
          "draft",
          "submitted",
          "under_review",
          "approved",
          "revision_requested",
          "rejected",
          "superseded",
          "archived",
        ),
        allowNull: false,
        defaultValue: "draft",
      },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      publishedAt: { type: DataTypes.DATE, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "assets", underscored: true, timestamps: true },
  );

  const AssetRelatedRecord = sequelize.define(
    "AssetRelatedRecord",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      assetId: { type: DataTypes.UUID, allowNull: false },
      moduleKey: { type: DataTypes.STRING(64), allowNull: false },
      recordId: { type: DataTypes.UUID, allowNull: false },
      note: { type: DataTypes.STRING(500), allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "asset_related_records", underscored: true, timestamps: true },
  );

  const models: AssetLibraryModels = { Asset, AssetRelatedRecord };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  brand-library/models.ts's own `resetBrandLibraryModelsForTests`. */
export function resetAssetLibraryModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
