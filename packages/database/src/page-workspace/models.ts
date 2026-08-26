import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";
// Single source of truth for both enums — deliberately NOT re-declared here, so a value added
// to `entities.ts` can never silently diverge from what the Sequelize model accepts.
import { PAGE_ARTIFACT_TYPES, PAGE_ARTIFACT_VERSION_STATUSES } from "./entities.js";

export interface PageWorkspaceModels {
  readonly PageArtifact: ModelStatic<Model>;
  readonly PageArtifactVersion: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, PageWorkspaceModels>();

export function getPageWorkspaceModels(
  sequelize: Sequelize = getConnection(),
): PageWorkspaceModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const PageArtifact = sequelize.define(
    "PageArtifact",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      pageId: { type: DataTypes.UUID, allowNull: false },
      projectId: { type: DataTypes.UUID, allowNull: false },
      artifactType: { type: DataTypes.ENUM(...PAGE_ARTIFACT_TYPES), allowNull: false },
      currentVersionId: { type: DataTypes.UUID, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "page_artifacts", underscored: true, timestamps: true },
  );

  const PageArtifactVersion = sequelize.define(
    "PageArtifactVersion",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      artifactId: { type: DataTypes.UUID, allowNull: false },
      pageId: { type: DataTypes.UUID, allowNull: false },
      projectId: { type: DataTypes.UUID, allowNull: false },
      versionNumber: { type: DataTypes.INTEGER, allowNull: false },
      status: {
        type: DataTypes.ENUM(...PAGE_ARTIFACT_VERSION_STATUSES),
        allowNull: false,
        defaultValue: "draft",
      },
      content: { type: DataTypes.TEXT, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      repository: { type: DataTypes.STRING(255), allowNull: true },
      path: { type: DataTypes.TEXT, allowNull: true },
      branch: { type: DataTypes.STRING(255), allowNull: true },
      commitSha: { type: DataTypes.STRING(64), allowNull: true },
      contentChecksum: { type: DataTypes.STRING(128), allowNull: true },
      reopenedReason: { type: DataTypes.TEXT, allowNull: true },
      reopenedFromVersionId: { type: DataTypes.UUID, allowNull: true },
      approvedByUserId: { type: DataTypes.UUID, allowNull: true },
      approvedAt: { type: DataTypes.DATE, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "page_artifact_versions", underscored: true, timestamps: true },
  );

  const models: PageWorkspaceModels = { PageArtifact, PageArtifactVersion };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors page-inventory/models.ts's own
 *  `resetPageInventoryModelsForTests`. */
export function resetPageWorkspaceModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
