import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface MotionAndInteractionLibraryModels {
  readonly MotionInteractionRecord: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, MotionAndInteractionLibraryModels>();

export function getMotionAndInteractionLibraryModels(
  sequelize: Sequelize = getConnection(),
): MotionAndInteractionLibraryModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const MotionInteractionRecord = sequelize.define(
    "MotionInteractionRecord",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      recordId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      category: {
        type: DataTypes.ENUM(
          "page_transition",
          "focus_state",
          "active_state",
          "selected_state",
          "disabled_state",
          "form_feedback",
          "menu",
          "modal_drawer",
          "tooltip",
          "sticky_behavior",
          "content_reveal",
          "loader",
          "progress_indicator",
          "success_error_state",
          "notification",
          "media_control",
          "filter_search",
          "pagination",
          "copy_share",
          "anchor_scroll",
          "parallax",
          "cursor",
          "dismissal",
          "screen_reader_announcement",
          "timing_and_interruption",
          "analytics_event",
          "no_js_fallback",
        ),
        allowNull: false,
      },
      versionNumber: { type: DataTypes.INTEGER, allowNull: false },
      isCurrent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      triggerAndBehavior: { type: DataTypes.TEXT, allowNull: true },
      timingAndEasing: { type: DataTypes.TEXT, allowNull: true },
      implementationSpec: { type: DataTypes.TEXT, allowNull: true },
      accessibilityNotes: { type: DataTypes.TEXT, allowNull: true },
      fallbackBehavior: { type: DataTypes.TEXT, allowNull: true },
      designReference: { type: DataTypes.TEXT, allowNull: true },
      relatedComponentIds: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
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
    { tableName: "motion_interaction_records", underscored: true, timestamps: true },
  );

  const models: MotionAndInteractionLibraryModels = { MotionInteractionRecord };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  section-and-pattern-library/models.ts's own
 *  `resetSectionAndPatternLibraryModelsForTests`. */
export function resetMotionAndInteractionLibraryModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
