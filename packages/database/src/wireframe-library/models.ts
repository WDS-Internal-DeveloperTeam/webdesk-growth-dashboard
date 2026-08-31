import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface WireframeLibraryModels {
  readonly WireframeRecord: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, WireframeLibraryModels>();

export function getWireframeLibraryModels(
  sequelize: Sequelize = getConnection(),
): WireframeLibraryModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const WireframeRecord = sequelize.define(
    "WireframeRecord",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      recordId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      pageOrModule: { type: DataTypes.TEXT, allowNull: false },
      versionNumber: { type: DataTypes.INTEGER, allowNull: false },
      isCurrent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      viewport: {
        type: DataTypes.ENUM("mobile", "tablet", "desktop"),
        allowNull: false,
      },
      fileReference: { type: DataTypes.TEXT, allowNull: true },
      annotations: { type: DataTypes.TEXT, allowNull: true },
      interactionNotes: { type: DataTypes.TEXT, allowNull: true },
      relatedTemplateId: { type: DataTypes.TEXT, allowNull: true },
      reviewerUserId: { type: DataTypes.UUID, allowNull: true },
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
    { tableName: "wireframe_records", underscored: true, timestamps: true },
  );

  const models: WireframeLibraryModels = { WireframeRecord };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  section-and-pattern-library/models.ts's own `resetSectionAndPatternLibraryModelsForTests`. */
export function resetWireframeLibraryModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
