import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface ComponentLibraryModels {
  readonly Component: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, ComponentLibraryModels>();

export function getComponentLibraryModels(
  sequelize: Sequelize = getConnection(),
): ComponentLibraryModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const Component = sequelize.define(
    "Component",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      recordId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      category: { type: DataTypes.STRING(100), allowNull: false },
      versionNumber: { type: DataTypes.INTEGER, allowNull: false },
      isCurrent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      name: { type: DataTypes.STRING(255), allowNull: false },
      figmaReference: { type: DataTypes.STRING(2_048), allowNull: true },
      tokenIds: { type: DataTypes.ARRAY(DataTypes.UUID), allowNull: false, defaultValue: [] },
      htmlStructure: { type: DataTypes.TEXT, allowNull: true },
      phpPath: { type: DataTypes.STRING(2_000), allowNull: true },
      scssClassesPath: { type: DataTypes.TEXT, allowNull: true },
      jsDependencies: { type: DataTypes.TEXT, allowNull: true },
      states: { type: DataTypes.TEXT, allowNull: true },
      responsiveBehavior: { type: DataTypes.TEXT, allowNull: true },
      browserSupport: { type: DataTypes.TEXT, allowNull: true },
      accessibility: { type: DataTypes.TEXT, allowNull: true },
      schema: { type: DataTypes.TEXT, allowNull: true },
      analytics: { type: DataTypes.TEXT, allowNull: true },
      tests: { type: DataTypes.TEXT, allowNull: true },
      replacementRecordId: { type: DataTypes.UUID, allowNull: true },
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
    { tableName: "components", underscored: true, timestamps: true },
  );

  const models: ComponentLibraryModels = { Component };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  design-token-library/models.ts's own `resetDesignTokenLibraryModelsForTests`. */
export function resetComponentLibraryModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
