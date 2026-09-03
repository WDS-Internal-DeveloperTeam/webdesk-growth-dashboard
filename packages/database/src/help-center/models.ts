import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface HelpCenterModels {
  readonly HelpArticle: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, HelpCenterModels>();

export function getHelpCenterModels(sequelize: Sequelize = getConnection()): HelpCenterModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const HelpArticle = sequelize.define(
    "HelpArticle",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      category: {
        type: DataTypes.ENUM(
          "onboarding",
          "project_setup",
          "wordpress_publishing",
          "review_approval",
          "staging_to_production",
          "import_export",
          "search_filtering",
          "design_libraries",
          "page_workspace",
          "security_qa",
          "backup_rollback",
          "faq",
          "videos",
          "known_issues",
          "feedback",
          "version_history",
        ),
        allowNull: false,
      },
      title: { type: DataTypes.STRING(255), allowNull: false },
      content: { type: DataTypes.TEXT, allowNull: false },
      isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      publishedAt: { type: DataTypes.DATE, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "help_articles", underscored: true, timestamps: true },
  );

  const models: HelpCenterModels = { HelpArticle };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests`. */
export function resetHelpCenterModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
