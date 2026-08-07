import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Many-to-many user↔role assignment — nothing in
 * `06_Roles_and_Permissions.md` restricts a user to exactly one role.
 * References `users` (Phase 1C, packages/database/src/migrations/00002).
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("user_roles", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    role_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "roles", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
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

  await context.addIndex("user_roles", ["user_id", "role_id"], {
    unique: true,
    name: "user_roles_user_role_unique",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("user_roles", {});
}
