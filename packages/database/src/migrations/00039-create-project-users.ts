import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The project team roster (task package §5, design decision D4). Grants NO authorization by
 * itself — actual project-scoped access continues to use the existing `user_roles.project_id`
 * mechanism (Phase 1D-expanded, migration `00016`). This table only records "who's associated
 * with this project," for display and future notification targeting.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("project_users", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "projects", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    added_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    added_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
  });

  await context.addIndex("project_users", ["project_id", "user_id"], {
    name: "project_users_project_user_unique",
    unique: true,
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("project_users", {});
}
