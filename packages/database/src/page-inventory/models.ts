import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";
// Owned by the Page Workspace module (migration `00068`) but physically a `pages` column, so
// the model must declare it. Imported, never re-declared, so the two can never diverge.
import { PAGE_LIFECYCLE_STAGES } from "../page-workspace/entities.js";

export interface PageInventoryModels {
  readonly Page: ModelStatic<Model>;
  readonly PageUrl: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, PageInventoryModels>();

export function getPageInventoryModels(
  sequelize: Sequelize = getConnection(),
): PageInventoryModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const Page = sequelize.define(
    "Page",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      pageName: { type: DataTypes.TEXT, allowNull: false },
      pageType: { type: DataTypes.STRING(255), allowNull: true },
      existingOrProposed: {
        type: DataTypes.ENUM("existing", "proposed"),
        allowNull: false,
        defaultValue: "proposed",
      },
      indexStatus: {
        type: DataTypes.ENUM("index", "noindex", "unknown"),
        allowNull: false,
        defaultValue: "unknown",
      },
      template: { type: DataTypes.STRING(255), allowNull: true },
      roadmapPhaseId: { type: DataTypes.UUID, allowNull: true },
      workflowStage: {
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
      lifecycleStage: {
        type: DataTypes.ENUM(...PAGE_LIFECYCLE_STAGES),
        allowNull: false,
        defaultValue: "proposed",
      },
      lifecyclePreviousStage: { type: DataTypes.ENUM(...PAGE_LIFECYCLE_STAGES), allowNull: true },
      targetKeyword: { type: DataTypes.STRING(255), allowNull: true },
      designVersion: { type: DataTypes.STRING(255), allowNull: true },
      repositoryFiles: { type: DataTypes.TEXT, allowNull: true },
      wordpressPageId: { type: DataTypes.STRING(255), allowNull: true },
      wordpressPostId: { type: DataTypes.STRING(255), allowNull: true },
      lastScanAt: { type: DataTypes.DATEONLY, allowNull: true },
      lastDeploymentAt: { type: DataTypes.DATEONLY, allowNull: true },
      classification: {
        type: DataTypes.ENUM(
          "keep",
          "optimize",
          "restructure",
          "redesign",
          "rebuild",
          "consolidate",
        ),
        allowNull: true,
      },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "pages", underscored: true, timestamps: true },
  );

  const PageUrl = sequelize.define(
    "PageUrl",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      pageId: { type: DataTypes.UUID, allowNull: false },
      projectId: { type: DataTypes.UUID, allowNull: false },
      url: { type: DataTypes.TEXT, allowNull: false },
      isCanonical: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: "page_urls", underscored: true, timestamps: true },
  );

  const models: PageInventoryModels = { Page, PageUrl };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  proof-and-claims-library/models.ts's own `resetProofAndClaimsLibraryModelsForTests`. */
export function resetPageInventoryModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
