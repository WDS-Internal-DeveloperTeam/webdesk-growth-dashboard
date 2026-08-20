import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface BusinessKnowledgeModels {
  readonly BusinessKnowledgeRecord: ModelStatic<Model>;
  readonly BusinessKnowledgeAttachment: ModelStatic<Model>;
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
      content: { type: DataTypes.TEXT, allowNull: true },
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

  const BusinessKnowledgeAttachment = sequelize.define(
    "BusinessKnowledgeAttachment",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      recordId: { type: DataTypes.UUID, allowNull: false },
      filename: { type: DataTypes.STRING(255), allowNull: false },
      mimeType: { type: DataTypes.STRING(255), allowNull: false },
      sizeBytes: { type: DataTypes.INTEGER, allowNull: false },
      checksumSha256: { type: DataTypes.STRING(64), allowNull: false },
      blobPathname: { type: DataTypes.STRING(1024), allowNull: false },
      extractedPreviewHtml: { type: DataTypes.TEXT, allowNull: true },
      scanStatus: {
        type: DataTypes.ENUM(
          "uploaded",
          "validation_passed",
          "validation_failed",
          "scan_not_configured",
          "externally_approved",
          "rejected",
          "deleted",
        ),
        allowNull: false,
        defaultValue: "scan_not_configured",
      },
      uploadedBy: { type: DataTypes.UUID, allowNull: true },
      // Attachments are immutable once created (a new upload replaces, per the task package's own
      // "not a word processor" scope note) — only `createdAt` exists, no `updatedAt` column.
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: "business_knowledge_attachments", underscored: true, timestamps: false },
  );

  const models: BusinessKnowledgeModels = { BusinessKnowledgeRecord, BusinessKnowledgeAttachment };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests`. */
export function resetBusinessKnowledgeModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
