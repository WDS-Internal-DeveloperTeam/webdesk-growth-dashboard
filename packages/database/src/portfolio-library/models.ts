import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface PortfolioLibraryModels {
  readonly PortfolioRecord: ModelStatic<Model>;
  readonly PortfolioAsset: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, PortfolioLibraryModels>();

export function getPortfolioLibraryModels(
  sequelize: Sequelize = getConnection(),
): PortfolioLibraryModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const PortfolioRecord = sequelize.define(
    "PortfolioRecord",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      projectOrClientName: { type: DataTypes.STRING(255), allowNull: false },
      url: { type: DataTypes.TEXT, allowNull: true },
      primaryCategory: { type: DataTypes.STRING(255), allowNull: true },
      additionalCategories: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      tags: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false, defaultValue: [] },
      industry: { type: DataTypes.STRING(255), allowNull: true },
      platform: { type: DataTypes.STRING(255), allowNull: true },
      serviceType: { type: DataTypes.STRING(255), allowNull: true },
      launchDate: { type: DataTypes.DATEONLY, allowNull: true },
      relatedProofIds: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      visibility: {
        type: DataTypes.ENUM("public", "internal_only", "confidential", "client_approval_required"),
        allowNull: false,
        defaultValue: "internal_only",
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
      isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      publishedAt: { type: DataTypes.DATE, allowNull: true },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "portfolio_records", underscored: true, timestamps: true },
  );

  const PortfolioAsset = sequelize.define(
    "PortfolioAsset",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      portfolioRecordId: { type: DataTypes.UUID, allowNull: false },
      assetId: { type: DataTypes.UUID, allowNull: false },
      role: { type: DataTypes.STRING(64), allowNull: false },
      caption: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: "portfolio_assets", underscored: true, timestamps: true },
  );

  const models: PortfolioLibraryModels = { PortfolioRecord, PortfolioAsset };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  content-template-library/models.ts's own `resetContentTemplateLibraryModelsForTests`. */
export function resetPortfolioLibraryModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
