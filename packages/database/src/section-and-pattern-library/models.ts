import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface SectionAndPatternLibraryModels {
  readonly SectionPatternRecord: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, SectionAndPatternLibraryModels>();

export function getSectionAndPatternLibraryModels(
  sequelize: Sequelize = getConnection(),
): SectionAndPatternLibraryModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const SectionPatternRecord = sequelize.define(
    "SectionPatternRecord",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      recordId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      patternType: {
        type: DataTypes.ENUM(
          "homepage_storytelling",
          "service",
          "industry",
          "location",
          "landing_conversion",
          "portfolio_showcase",
          "social_proof",
          "results_metrics",
          "engagement_models",
          "team_expertise",
          "content_hub",
          "article",
          "lead_capture",
          "download",
          "multi_step_form",
          "search_filter",
          "trust",
          "objection_handling",
          "cross_sell",
          "error_no_results",
        ),
        allowNull: false,
      },
      versionNumber: { type: DataTypes.INTEGER, allowNull: false },
      isCurrent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      designReference: { type: DataTypes.TEXT, allowNull: true },
      htmlStructure: { type: DataTypes.TEXT, allowNull: true },
      phpPath: { type: DataTypes.STRING(500), allowNull: true },
      scssReference: { type: DataTypes.TEXT, allowNull: true },
      jsDependencies: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      responsiveBehavior: { type: DataTypes.TEXT, allowNull: true },
      accessibilityNotes: { type: DataTypes.TEXT, allowNull: true },
      browserSupport: { type: DataTypes.TEXT, allowNull: true },
      tokenReferences: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      relatedComponentIds: {
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
    { tableName: "section_pattern_records", underscored: true, timestamps: true },
  );

  const models: SectionAndPatternLibraryModels = { SectionPatternRecord };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  design-token-library/models.ts's own `resetDesignTokenLibraryModelsForTests`. */
export function resetSectionAndPatternLibraryModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
