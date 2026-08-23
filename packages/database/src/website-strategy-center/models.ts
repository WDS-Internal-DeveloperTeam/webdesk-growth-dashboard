import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface WebsiteStrategyCenterModels {
  readonly WebsiteStrategyRecord: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, WebsiteStrategyCenterModels>();

export function getWebsiteStrategyCenterModels(
  sequelize: Sequelize = getConnection(),
): WebsiteStrategyCenterModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const WebsiteStrategyRecord = sequelize.define(
    "WebsiteStrategyRecord",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      recordId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      recordType: {
        type: DataTypes.ENUM(
          "navigation_plan",
          "page_clusters",
          "pillar_strategy",
          "platform_strategy",
          "industry_strategy",
          "location_strategy",
          "conversion_plan",
          "search_plan",
          "internal_link_plan",
        ),
        allowNull: false,
      },
      versionNumber: { type: DataTypes.INTEGER, allowNull: false },
      isCurrent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      title: { type: DataTypes.TEXT, allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
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
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "website_strategy_records", underscored: true, timestamps: true },
  );

  const models: WebsiteStrategyCenterModels = { WebsiteStrategyRecord };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  proof-and-claims-library/models.ts's own `resetProofAndClaimsLibraryModelsForTests`. */
export function resetWebsiteStrategyCenterModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
