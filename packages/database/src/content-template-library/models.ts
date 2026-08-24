import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface ContentTemplateLibraryModels {
  readonly ContentTemplate: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, ContentTemplateLibraryModels>();

export function getContentTemplateLibraryModels(
  sequelize: Sequelize = getConnection(),
): ContentTemplateLibraryModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const ContentTemplate = sequelize.define(
    "ContentTemplate",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      pageType: { type: DataTypes.STRING(255), allowNull: false },
      purpose: { type: DataTypes.TEXT, allowNull: true },
      requiredSections: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
      optionalSections: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
      proofRules: { type: DataTypes.TEXT, allowNull: true },
      seoAeoGeoRequirements: { type: DataTypes.TEXT, allowNull: true },
      schema: { type: DataTypes.TEXT, allowNull: true },
      ctaRules: { type: DataTypes.TEXT, allowNull: true },
      contentDepthGuidance: { type: DataTypes.TEXT, allowNull: true },
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
    { tableName: "content_templates", underscored: true, timestamps: true },
  );

  const models: ContentTemplateLibraryModels = { ContentTemplate };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  persona-library/models.ts's own `resetPersonaLibraryModelsForTests`. */
export function resetContentTemplateLibraryModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
