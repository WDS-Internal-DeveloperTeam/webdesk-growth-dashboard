import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface WorkflowTaskTemplateModels {
  readonly WorkflowTaskTemplate: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, WorkflowTaskTemplateModels>();

export function getWorkflowTaskTemplateModels(
  sequelize: Sequelize = getConnection(),
): WorkflowTaskTemplateModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const WorkflowTaskTemplate = sequelize.define(
    "WorkflowTaskTemplate",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      templateType: {
        type: DataTypes.ENUM(
          "existing_page_audit",
          "new_page_opportunity",
          "search_brief",
          "content",
          "case_study",
          "design",
          "development",
          "code_review",
          "security",
          "qa",
          "release",
        ),
        allowNull: false,
      },
      title: { type: DataTypes.STRING(255), allowNull: false },
      authorizedStage: { type: DataTypes.STRING(255), allowNull: false },
      requiredInputs: { type: DataTypes.TEXT, allowNull: true },
      expectedOutputs: { type: DataTypes.TEXT, allowNull: true },
      restrictions: { type: DataTypes.TEXT, allowNull: true },
      agentAssignment: { type: DataTypes.STRING(255), allowNull: true },
      validationCriteria: { type: DataTypes.TEXT, allowNull: true },
      requiredApprovals: { type: DataTypes.STRING(500), allowNull: true },
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
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "workflow_task_templates", underscored: true, timestamps: true },
  );

  const models: WorkflowTaskTemplateModels = { WorkflowTaskTemplate };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  brand-library/models.ts's own `resetBrandLibraryModelsForTests`. */
export function resetWorkflowTaskTemplateModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
