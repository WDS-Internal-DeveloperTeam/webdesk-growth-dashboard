import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Repository metadata for a project (task package §5, design decision D5) — reference/display
 * only. No live GitHub validation: neither ADR-0011 nor `docs/contracts/github-integration-contract.md`
 * describes a mechanism for linking an arbitrary client repo to the GitHub App's actual
 * installation scope (the App is scoped only to this dashboard's own two known repos), so this
 * table stores owner/name/branch as plain metadata, never calling the GitHub API.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("project_repositories", {
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
    provider: {
      type: DataTypes.ENUM("github"),
      allowNull: false,
      defaultValue: "github",
    },
    repo_owner: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    repo_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    default_branch: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "main",
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

  // Key index per 04_Data_Model_and_Ownership.md line 41: "repository name".
  await context.addIndex("project_repositories", ["project_id", "repo_owner", "repo_name"], {
    name: "project_repositories_project_repo_unique",
    unique: true,
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("project_repositories", {});
  await context.sequelize.query(`DROP TYPE IF EXISTS "enum_project_repositories_provider";`);
}
