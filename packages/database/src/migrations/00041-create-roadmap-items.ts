import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Roadmap items — represents both "phases" and "roadmap" from the module spec's prose (task
 * package design decision D3: `04_Data_Model_and_Ownership.md` names only one entity,
 * `roadmap_items`, for both). The partial unique index enforces "at most one active phase per
 * project" at the database layer rather than trusting application code alone — the same
 * "enforce the real invariant at the DB layer" discipline ADR-0017's audit-immutability trigger
 * already established for this project.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("roadmap_items", {
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
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    sequence: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM("not_started", "active", "complete", "skipped"),
      allowNull: false,
      defaultValue: "not_started",
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

  // No (project_id, status) index: no query filters roadmap items by status (code review
  // finding) — listByProject() orders by (project_id, sequence) only, covered below.
  await context.addIndex("roadmap_items", ["project_id", "sequence"], {
    name: "roadmap_items_project_sequence_idx",
  });
  // D3's invariant: at most one 'active' roadmap item per project.
  await context.addIndex("roadmap_items", ["project_id"], {
    name: "roadmap_items_one_active_per_project",
    unique: true,
    where: { status: "active" },
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("roadmap_items", {});
  await context.sequelize.query(`DROP TYPE IF EXISTS "enum_roadmap_items_status";`);
}
