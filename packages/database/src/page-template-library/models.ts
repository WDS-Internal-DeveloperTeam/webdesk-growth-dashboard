import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface PageTemplateLibraryModels {
  readonly PageTemplate: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, PageTemplateLibraryModels>();

export function getPageTemplateLibraryModels(
  sequelize: Sequelize = getConnection(),
): PageTemplateLibraryModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const PageTemplate = sequelize.define(
    "PageTemplate",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      recordId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      pageType: {
        type: DataTypes.ENUM(
          "homepage",
          "service",
          "platform",
          "industry",
          "location",
          "case_study",
          "portfolio",
          "landing",
          "article",
          "about",
          "contact",
          "team",
          "careers",
          "archive_category",
          "confirmation",
          "not_found",
          "campaign_event",
        ),
        allowNull: false,
      },
      versionNumber: { type: DataTypes.INTEGER, allowNull: false },
      isCurrent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      name: { type: DataTypes.STRING(255), allowNull: false },
      requiredSectionIds: {
        type: DataTypes.ARRAY(DataTypes.UUID),
        allowNull: false,
        defaultValue: [],
      },
      optionalSectionIds: {
        type: DataTypes.ARRAY(DataTypes.UUID),
        allowNull: false,
        defaultValue: [],
      },
      supportedComponentIds: {
        type: DataTypes.ARRAY(DataTypes.UUID),
        allowNull: false,
        defaultValue: [],
      },
      wireframeReferences: {
        type: DataTypes.ARRAY(DataTypes.STRING(500)),
        allowNull: false,
        defaultValue: [],
      },
      contentRequirements: { type: DataTypes.TEXT, allowNull: true },
      searchRequirements: { type: DataTypes.TEXT, allowNull: true },
      conversionGoal: { type: DataTypes.TEXT, allowNull: true },
      phpTemplateRelationship: { type: DataTypes.STRING(2_000), allowNull: true },
      replacementRecordId: { type: DataTypes.UUID, allowNull: true },
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
    { tableName: "page_templates", underscored: true, timestamps: true },
  );

  const models: PageTemplateLibraryModels = { PageTemplate };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  component-library/models.ts's own `resetComponentLibraryModelsForTests`. */
export function resetPageTemplateLibraryModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
