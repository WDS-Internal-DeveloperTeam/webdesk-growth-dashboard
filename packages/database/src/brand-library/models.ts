import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface BrandLibraryModels {
  readonly BrandLibraryRecord: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, BrandLibraryModels>();

export function getBrandLibraryModels(sequelize: Sequelize = getConnection()): BrandLibraryModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const BrandLibraryRecord = sequelize.define(
    "BrandLibraryRecord",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      recordType: {
        type: DataTypes.ENUM(
          "logo",
          "color",
          "typography",
          "photography",
          "illustration",
          "icon_rule",
          "tone",
          "visual_personality",
          "dos_dont",
        ),
        allowNull: false,
      },
      title: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      fileReference: { type: DataTypes.STRING(2048), allowNull: true },
      usageNotes: { type: DataTypes.TEXT, allowNull: true },
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
    { tableName: "brand_library_records", underscored: true, timestamps: true },
  );

  const models: BrandLibraryModels = { BrandLibraryRecord };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  content-template-library/models.ts's own `resetContentTemplateLibraryModelsForTests`. */
export function resetBrandLibraryModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
