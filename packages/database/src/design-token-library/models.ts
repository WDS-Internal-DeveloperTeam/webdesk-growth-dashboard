import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface DesignTokenLibraryModels {
  readonly DesignToken: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, DesignTokenLibraryModels>();

export function getDesignTokenLibraryModels(
  sequelize: Sequelize = getConnection(),
): DesignTokenLibraryModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const DesignToken = sequelize.define(
    "DesignToken",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      recordId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      group: {
        type: DataTypes.ENUM(
          "colors",
          "semantic_statuses",
          "theme",
          "typography",
          "spacing",
          "grids",
          "breakpoints",
          "borders",
          "shadows",
          "opacity_and_z_index",
          "icon_sizes",
          "media_ratios",
          "component_sizes",
          "motion",
          "interactive_states",
        ),
        allowNull: false,
      },
      versionNumber: { type: DataTypes.INTEGER, allowNull: false },
      isCurrent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      name: { type: DataTypes.STRING(255), allowNull: false },
      value: { type: DataTypes.TEXT, allowNull: false },
      unit: { type: DataTypes.STRING(32), allowNull: true },
      semanticPurpose: { type: DataTypes.TEXT, allowNull: true },
      responsiveVariation: { type: DataTypes.TEXT, allowNull: true },
      themeVariation: { type: DataTypes.ENUM("light", "dark", "both"), allowNull: true },
      usageReferences: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
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
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "design_tokens", underscored: true, timestamps: true },
  );

  const models: DesignTokenLibraryModels = { DesignToken };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  website-strategy-center/models.ts's own `resetWebsiteStrategyCenterModelsForTests`. */
export function resetDesignTokenLibraryModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
