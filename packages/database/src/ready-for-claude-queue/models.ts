import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface ReadyForClaudeQueueModels {
  readonly ReadyForClaudeTask: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, ReadyForClaudeQueueModels>();

export function getReadyForClaudeQueueModels(
  sequelize: Sequelize = getConnection(),
): ReadyForClaudeQueueModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const ReadyForClaudeTask = sequelize.define(
    "ReadyForClaudeTask",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      title: { type: DataTypes.STRING(500), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      priority: {
        type: DataTypes.ENUM("low", "medium", "high", "critical"),
        allowNull: false,
        defaultValue: "medium",
      },
      agent: { type: DataTypes.STRING(255), allowNull: true },
      agentVersion: { type: DataTypes.STRING(100), allowNull: true },
      projectId: { type: DataTypes.UUID, allowNull: true },
      targetModuleKey: { type: DataTypes.STRING(64), allowNull: true },
      targetId: { type: DataTypes.UUID, allowNull: true },
      status: {
        type: DataTypes.ENUM(
          "draft",
          "ready_for_claude",
          "claimed",
          "in_progress",
          "awaiting_review",
          "changes_requested",
          "approved",
          "completed",
          "cancelled",
          "paused",
          "failed",
        ),
        allowNull: false,
        defaultValue: "draft",
      },
      stage: { type: DataTypes.STRING(255), allowNull: true },
      dependencies: {
        type: DataTypes.ARRAY(DataTypes.UUID),
        allowNull: false,
        defaultValue: [],
      },
      operatorUserId: { type: DataTypes.UUID, allowNull: true },
      developerUserId: { type: DataTypes.UUID, allowNull: true },
      featureBranch: { type: DataTypes.STRING(255), allowNull: true },
      sourceCommit: { type: DataTypes.STRING(100), allowNull: true },
      prId: { type: DataTypes.STRING(100), allowNull: true },
      prUrl: { type: DataTypes.TEXT, allowNull: true },
      prStatus: { type: DataTypes.STRING(100), allowNull: true },
      reviewerUserId: { type: DataTypes.UUID, allowNull: true },
      codeReviewResult: { type: DataTypes.STRING(100), allowNull: true },
      stagingCommit: { type: DataTypes.STRING(100), allowNull: true },
      stagingDeployment: { type: DataTypes.STRING(255), allowNull: true },
      stagingUrl: { type: DataTypes.TEXT, allowNull: true },
      dashboardReview: { type: DataTypes.TEXT, allowNull: true },
      changesRequestedNotes: { type: DataTypes.TEXT, allowNull: true },
      productionApproval: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      productionApproverUserId: { type: DataTypes.UUID, allowNull: true },
      productionCommit: { type: DataTypes.STRING(100), allowNull: true },
      productionDeployment: { type: DataTypes.STRING(255), allowNull: true },
      productionVerification: { type: DataTypes.TEXT, allowNull: true },
      rollbackVersion: { type: DataTypes.STRING(100), allowNull: true },
      failureReason: { type: DataTypes.TEXT, allowNull: true },
      retryCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      dueDate: { type: DataTypes.DATE, allowNull: true },
      auditReference: { type: DataTypes.STRING(255), allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "ready_for_claude_tasks", underscored: true, timestamps: true },
  );

  const models: ReadyForClaudeQueueModels = { ReadyForClaudeTask };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  `internal-linking-library/models.ts`'s own `resetInternalLinkingLibraryModelsForTests`. */
export function resetReadyForClaudeQueueModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
