import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

/** Sequelize model definitions for the RBAC schema (src/migrations/00009-00013) — same lazy, per-connection-cached pattern as ../auth/models.ts. */
export interface AuthzModels {
  readonly Role: ModelStatic<Model>;
  readonly Module: ModelStatic<Model>;
  readonly RolePermission: ModelStatic<Model>;
  readonly UserRole: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, AuthzModels>();

export function getAuthzModels(sequelize: Sequelize = getConnection()): AuthzModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const Role = sequelize.define(
    "Role",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      key: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      name: { type: DataTypes.STRING, allowNull: false },
    },
    { tableName: "roles", underscored: true, timestamps: true, paranoid: false },
  );

  const Module = sequelize.define(
    "Module",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      key: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      name: { type: DataTypes.STRING, allowNull: false },
    },
    { tableName: "modules", underscored: true, timestamps: true, paranoid: false },
  );

  const RolePermission = sequelize.define(
    "RolePermission",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      roleId: { type: DataTypes.UUID, allowNull: false },
      moduleId: { type: DataTypes.UUID, allowNull: false },
      action: { type: DataTypes.STRING(32), allowNull: false },
      projectId: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "role_permissions", underscored: true, timestamps: true, paranoid: false },
  );

  const UserRole = sequelize.define(
    "UserRole",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      roleId: { type: DataTypes.UUID, allowNull: false },
    },
    { tableName: "user_roles", underscored: true, timestamps: true, paranoid: false },
  );

  const models: AuthzModels = { Role, Module, RolePermission, UserRole };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors ../connection.ts's `resetConnectionForTests`. */
export function resetAuthzModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
