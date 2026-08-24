import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface ReviewAndApprovalCenterModels {
  readonly Review: ModelStatic<Model>;
  readonly ReviewComment: ModelStatic<Model>;
  readonly ReviewDecision: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, ReviewAndApprovalCenterModels>();

export function getReviewAndApprovalCenterModels(
  sequelize: Sequelize = getConnection(),
): ReviewAndApprovalCenterModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const Review = sequelize.define(
    "Review",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      targetModuleKey: { type: DataTypes.STRING(64), allowNull: false },
      targetId: { type: DataTypes.UUID, allowNull: false },
      targetLabel: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM("submitted", "revision_requested", "approved", "rejected"),
        allowNull: false,
        defaultValue: "submitted",
      },
      isPaused: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      submittedByUserId: { type: DataTypes.UUID, allowNull: false },
      assignedToUserId: { type: DataTypes.UUID, allowNull: true },
      decidedByUserId: { type: DataTypes.UUID, allowNull: true },
      decidedAt: { type: DataTypes.DATE, allowNull: true },
      versionALabel: { type: DataTypes.TEXT, allowNull: true },
      versionBLabel: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: "reviews", underscored: true, timestamps: true },
  );

  const ReviewComment = sequelize.define(
    "ReviewComment",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      reviewId: { type: DataTypes.UUID, allowNull: false },
      authorUserId: { type: DataTypes.UUID, allowNull: false },
      body: { type: DataTypes.TEXT, allowNull: false },
    },
    { tableName: "review_comments", underscored: true, timestamps: true, updatedAt: false },
  );

  const ReviewDecision = sequelize.define(
    "ReviewDecision",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      reviewId: { type: DataTypes.UUID, allowNull: false },
      action: {
        type: DataTypes.ENUM(
          "approve",
          "approve_with_notes",
          "request_revision",
          "reject",
          "pause",
          "resume",
          "delegate",
        ),
        allowNull: false,
      },
      actorUserId: { type: DataTypes.UUID, allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
      delegatedToUserId: { type: DataTypes.UUID, allowNull: true },
      decidedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: "review_decisions", underscored: true, timestamps: false },
  );

  const models: ReviewAndApprovalCenterModels = { Review, ReviewComment, ReviewDecision };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  content-template-library/models.ts's own `resetContentTemplateLibraryModelsForTests`. */
export function resetReviewAndApprovalCenterModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
