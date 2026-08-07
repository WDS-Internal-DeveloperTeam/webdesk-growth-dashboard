import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The 21 module keys from `06_Roles_and_Permissions.md §3`'s matrix
 * columns — real, already-approved vocabulary, not placeholder data. A
 * module existing here does not imply its own feature/endpoints exist yet
 * (most don't — see docs/task-packages/phase-1d-rbac-authorization.md §5);
 * it only means the module is a valid target for a permission grant, so
 * the framework is immediately spec-complete even though most modules'
 * own CRUD is built later.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("modules", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    key: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("modules", {});
}
