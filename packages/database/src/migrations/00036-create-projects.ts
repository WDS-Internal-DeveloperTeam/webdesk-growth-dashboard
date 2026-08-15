import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The Projects module foundation (`docs/task-packages/module-projects-foundation.md` §5, design
 * decision D2). `active_phase_id` is added in a later migration (`00042`) once `roadmap_items`
 * exists — the two tables reference each other, so neither can hold a real FK to the other at
 * creation time. No `deleted_at`/`version`/`audit_context_id` columns: no code path in this module
 * uses them (archival via `status` is the only "removal" concept V1 implements), matching the
 * leaner field set every real Phase 1E table actually shipped with rather than the full aspirational
 * base-entity list in `04_Data_Model_and_Ownership.md` §1.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("projects", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    /** Stable, human-readable identifier — never regenerated once assigned (task package rule 5). */
    public_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "paused", "archived"),
      allowNull: false,
      defaultValue: "active",
    },
    owner_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    confidentiality: {
      type: DataTypes.ENUM("public", "internal", "confidential", "restricted"),
      allowNull: false,
      defaultValue: "internal",
    },
    /** Left unset — no approved retention category names project records specifically (task package D6). */
    retention_category: {
      type: DataTypes.STRING(64),
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

  await context.addIndex("projects", ["public_id"], {
    name: "projects_public_id_unique",
    unique: true,
  });
  // Key index per 04_Data_Model_and_Ownership.md line 41: "project status".
  await context.addIndex("projects", ["status"], { name: "projects_status_idx" });
  // ProjectRepository.listProjects() defaults to ORDER BY updated_at DESC (code review finding).
  await context.addIndex("projects", ["updated_at"], { name: "projects_updated_at_idx" });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("projects", {});
  await context.sequelize.query(`DROP TYPE IF EXISTS "enum_projects_status";`);
  await context.sequelize.query(`DROP TYPE IF EXISTS "enum_projects_confidentiality";`);
}
