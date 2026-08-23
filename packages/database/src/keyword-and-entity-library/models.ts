import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface KeywordAndEntityLibraryModels {
  readonly Keyword: ModelStatic<Model>;
  readonly EntityRecord: ModelStatic<Model>;
  readonly KeywordEntityRelationship: ModelStatic<Model>;
  readonly PageKeywordAssignment: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, KeywordAndEntityLibraryModels>();

export function getKeywordAndEntityLibraryModels(
  sequelize: Sequelize = getConnection(),
): KeywordAndEntityLibraryModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const Keyword = sequelize.define(
    "Keyword",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      queryText: { type: DataTypes.STRING(500), allowNull: false },
      keywordType: { type: DataTypes.STRING(100), allowNull: true },
      intent: { type: DataTypes.STRING(100), allowNull: true },
      funnelStage: { type: DataTypes.STRING(100), allowNull: true },
      country: { type: DataTypes.STRING(100), allowNull: true },
      searchVolume: { type: DataTypes.INTEGER, allowNull: true },
      difficultyScore: { type: DataTypes.INTEGER, allowNull: true },
      source: { type: DataTypes.STRING(200), allowNull: true },
      researchDate: { type: DataTypes.DATEONLY, allowNull: true },
      cannibalizationNotes: { type: DataTypes.TEXT, allowNull: true },
      confidence: { type: DataTypes.ENUM("low", "medium", "high"), allowNull: true },
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
    { tableName: "keywords", underscored: true, timestamps: true },
  );

  const EntityRecord = sequelize.define(
    "EntityRecord",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      entityType: { type: DataTypes.STRING(100), allowNull: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "entities", underscored: true, timestamps: true },
  );

  const KeywordEntityRelationship = sequelize.define(
    "KeywordEntityRelationship",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      keywordId: { type: DataTypes.UUID, allowNull: false },
      entityId: { type: DataTypes.UUID, allowNull: false },
      createdBy: { type: DataTypes.UUID, allowNull: true },
    },
    {
      tableName: "keyword_entity_relationships",
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );

  const PageKeywordAssignment = sequelize.define(
    "PageKeywordAssignment",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      keywordId: { type: DataTypes.UUID, allowNull: false },
      pageId: { type: DataTypes.UUID, allowNull: false },
      assignmentNote: { type: DataTypes.STRING(500), allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
    },
    {
      tableName: "page_keyword_assignments",
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );

  const models: KeywordAndEntityLibraryModels = {
    Keyword,
    EntityRecord,
    KeywordEntityRelationship,
    PageKeywordAssignment,
  };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  `page-inventory/models.ts`'s own `resetPageInventoryModelsForTests`. */
export function resetKeywordAndEntityLibraryModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
