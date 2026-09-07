import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface SystemSettingModels {
  readonly SystemSetting: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, SystemSettingModels>();

export function getSystemSettingModels(
  sequelize: Sequelize = getConnection(),
): SystemSettingModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const SystemSetting = sequelize.define(
    "SystemSetting",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      settingType: {
        type: DataTypes.ENUM(
          "status_definition",
          "category_definition",
          "taxonomy_definition",
          "file_limit",
          "git_rule",
          "backup_rule",
          "escalation_sla",
          "documentation_rule",
          "environment",
        ),
        allowNull: false,
      },
      key: { type: DataTypes.STRING(200), allowNull: false },
      value: { type: DataTypes.JSONB, allowNull: false },
      description: { type: DataTypes.STRING(2000), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "system_settings", underscored: true, timestamps: true },
  );

  const models: SystemSettingModels = { SystemSetting };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  brand-library/models.ts's own `resetBrandLibraryModelsForTests`. */
export function resetSystemSettingModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
