import { DataTypes, type QueryInterface } from "sequelize";

/**
 * ADR-0010 — the 7 roles from `06_Roles_and_Permissions.md §1`, already
 * fully specified/approved (that document's own status has no open setup
 * value for the role list). Fixed for V1: this phase exposes role
 * *assignment* to users, not role *creation* — no API path creates a new
 * row here, only the seed migration (00013) does.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("roles", {
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
  await context.dropTable("roles", {});
}
