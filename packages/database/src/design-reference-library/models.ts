import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface DesignReferenceLibraryModels {
  readonly DesignReferenceRecord: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, DesignReferenceLibraryModels>();

export function getDesignReferenceLibraryModels(
  sequelize: Sequelize = getConnection(),
): DesignReferenceLibraryModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const DesignReferenceRecord = sequelize.define(
    "DesignReferenceRecord",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      title: { type: DataTypes.STRING(255), allowNull: false },
      sourceUrl: { type: DataTypes.STRING(2048), allowNull: true },
      screenshotUrl: { type: DataTypes.STRING(2048), allowNull: true },
      pageSectionType: { type: DataTypes.STRING(255), allowNull: true },
      likes: { type: DataTypes.TEXT, allowNull: true },
      dislikes: { type: DataTypes.TEXT, allowNull: true },
      desktopBehavior: { type: DataTypes.STRING(2000), allowNull: true },
      mobileBehavior: { type: DataTypes.STRING(2000), allowNull: true },
      motionNotes: { type: DataTypes.TEXT, allowNull: true },
      accessibilityConcerns: { type: DataTypes.TEXT, allowNull: true },
      performanceConcerns: { type: DataTypes.TEXT, allowNull: true },
      // Plain unvalidated tag list (D6), mirroring PersonaEntity.roles/ServiceEntity.icpIds's own
      // identical shape — non-nullable, defaulting to an empty array, not a nullable column.
      tags: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false, defaultValue: [] },
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
    { tableName: "design_reference_records", underscored: true, timestamps: true },
  );

  const models: DesignReferenceLibraryModels = { DesignReferenceRecord };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  brand-library/models.ts's own `resetBrandLibraryModelsForTests`. */
export function resetDesignReferenceLibraryModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
