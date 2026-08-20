import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface BusinessKnowledgeModels {
  readonly BusinessKnowledgeRecord: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, BusinessKnowledgeModels>();

export function getBusinessKnowledgeModels(
  sequelize: Sequelize = getConnection(),
): BusinessKnowledgeModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const BusinessKnowledgeRecord = sequelize.define(
    "BusinessKnowledgeRecord",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      recordType: {
        type: DataTypes.ENUM(
          "company_profile",
          "persona_icp",
          "marketing_profile",
          "vto",
          "service_taxonomy",
          "engagement_model",
          "approved_messaging",
          "competitor",
          "geographic_scope",
          "strategic_priority",
        ),
        allowNull: false,
      },
      title: { type: DataTypes.STRING(255), allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      status: {
        type: DataTypes.ENUM("mandatory", "advisory", "draft", "deprecated", "restricted"),
        allowNull: false,
        defaultValue: "draft",
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "business_knowledge_records", underscored: true, timestamps: true },
  );

  const models: BusinessKnowledgeModels = { BusinessKnowledgeRecord };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests`. */
export function resetBusinessKnowledgeModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
