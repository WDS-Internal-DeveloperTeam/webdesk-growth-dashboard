import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface KnowledgeLibraryModels {
  readonly KnowledgeLibraryRecord: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, KnowledgeLibraryModels>();

export function getKnowledgeLibraryModels(
  sequelize: Sequelize = getConnection(),
): KnowledgeLibraryModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const KnowledgeLibraryRecord = sequelize.define(
    "KnowledgeLibraryRecord",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      title: { type: DataTypes.STRING(255), allowNull: false },
      sourceType: { type: DataTypes.STRING(100), allowNull: true },
      location: { type: DataTypes.STRING(2048), allowNull: true },
      ownerUserId: { type: DataTypes.UUID, allowNull: true },
      sourceDate: { type: DataTypes.DATEONLY, allowNull: true },
      confidentiality: {
        type: DataTypes.ENUM("public", "internal", "restricted"),
        allowNull: false,
        defaultValue: "public",
      },
      approvedForAgentUse: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      status: {
        type: DataTypes.ENUM("draft", "mandatory", "advisory", "deprecated"),
        allowNull: false,
        defaultValue: "draft",
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
      relatedEntityIds: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      lastReviewedAt: { type: DataTypes.DATE, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "knowledge_library_records", underscored: true, timestamps: true },
  );

  const models: KnowledgeLibraryModels = { KnowledgeLibraryRecord };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests`. */
export function resetKnowledgeLibraryModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
