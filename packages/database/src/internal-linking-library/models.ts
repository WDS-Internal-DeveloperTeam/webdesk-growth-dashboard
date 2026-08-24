import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface InternalLinkingLibraryModels {
  readonly InternalLink: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, InternalLinkingLibraryModels>();

export function getInternalLinkingLibraryModels(
  sequelize: Sequelize = getConnection(),
): InternalLinkingLibraryModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const InternalLink = sequelize.define(
    "InternalLink",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      sourcePageId: { type: DataTypes.UUID, allowNull: false },
      targetPageId: { type: DataTypes.UUID, allowNull: false },
      relationship: { type: DataTypes.STRING(255), allowNull: true },
      anchor: { type: DataTypes.STRING(255), allowNull: true },
      context: { type: DataTypes.TEXT, allowNull: true },
      linkType: { type: DataTypes.STRING(255), allowNull: true },
      priority: { type: DataTypes.ENUM("low", "medium", "high"), allowNull: true },
      status: {
        type: DataTypes.ENUM("proposed", "approved", "implemented", "verified"),
        allowNull: false,
        defaultValue: "proposed",
      },
      detector: { type: DataTypes.STRING(255), allowNull: true },
      assignedApproverUserId: { type: DataTypes.UUID, allowNull: true },
      relatedStrategyRecordId: { type: DataTypes.UUID, allowNull: true },
      implementedAt: { type: DataTypes.DATE, allowNull: true },
      verifiedAt: { type: DataTypes.DATE, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "internal_links", underscored: true, timestamps: true },
  );

  const models: InternalLinkingLibraryModels = { InternalLink };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  `keyword-and-entity-library/models.ts`'s own `resetKeywordAndEntityLibraryModelsForTests`. */
export function resetInternalLinkingLibraryModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
