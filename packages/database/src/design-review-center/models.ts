import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface DesignReviewCenterModels {
  readonly DesignReview: ModelStatic<Model>;
  readonly DesignReviewDecision: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, DesignReviewCenterModels>();

export function getDesignReviewCenterModels(
  sequelize: Sequelize = getConnection(),
): DesignReviewCenterModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const DesignReview = sequelize.define(
    "DesignReview",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      targetModuleKey: { type: DataTypes.STRING(64), allowNull: false },
      targetId: { type: DataTypes.UUID, allowNull: false },
      targetLabel: { type: DataTypes.TEXT, allowNull: true },
      reviewType: {
        type: DataTypes.ENUM(
          "creative_direction",
          "ux",
          "conversion",
          "ui",
          "accessibility_by_design",
          "responsive_behavior",
          "component_consistency",
          "motion",
          "performance_impact",
        ),
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM(
          "submitted",
          "revision_requested",
          "approved",
          "rejected",
          "superseded",
        ),
        allowNull: false,
        defaultValue: "submitted",
      },
      submittedByUserId: { type: DataTypes.UUID, allowNull: false },
      assignedToUserId: { type: DataTypes.UUID, allowNull: true },
      decidedByUserId: { type: DataTypes.UUID, allowNull: true },
      decidedAt: { type: DataTypes.DATE, allowNull: true },
      versionALabel: { type: DataTypes.TEXT, allowNull: true },
      versionBLabel: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: "design_reviews", underscored: true, timestamps: true },
  );

  const DesignReviewDecision = sequelize.define(
    "DesignReviewDecision",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      reviewId: { type: DataTypes.UUID, allowNull: false },
      action: {
        type: DataTypes.ENUM(
          "approve",
          "approve_with_notes",
          "request_revision",
          "reject",
          "supersede",
        ),
        allowNull: false,
      },
      actorUserId: { type: DataTypes.UUID, allowNull: false },
      notes: { type: DataTypes.TEXT, allowNull: true },
      decidedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: "design_review_decisions", underscored: true, timestamps: false },
  );

  const models: DesignReviewCenterModels = { DesignReview, DesignReviewDecision };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  review-and-approval-center/models.ts's own `resetReviewAndApprovalCenterModelsForTests`. */
export function resetDesignReviewCenterModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
