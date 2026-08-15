import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Environment metadata for a project (task package §5) — reference/display only, per task
 * package rule 10: no credential/secret columns exist here, and none should ever be added.
 * `ON DELETE CASCADE` on `project_id` is safe: this is the project's own configuration
 * sub-resource, not a separate website/business record (task package rule 7 is about NOT
 * cascading into those, e.g. Pages), and no code path hard-deletes a `projects` row anyway.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("project_environments", {
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
    name: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    updated_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
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

  // Key index per 04_Data_Model_and_Ownership.md line 41: "environment".
  await context.addIndex("project_environments", ["project_id", "name"], {
    name: "project_environments_project_name_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("project_environments", {});
}
