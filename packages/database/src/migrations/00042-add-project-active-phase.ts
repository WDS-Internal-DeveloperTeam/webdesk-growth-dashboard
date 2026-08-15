import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Adds `projects.active_phase_id` now that `roadmap_items` exists (task package §5, design
 * decision D3) — the two tables reference each other, so this column couldn't be added at
 * `projects`' own creation time. `ON DELETE SET NULL`: removing/replacing the active roadmap item
 * should clear the pointer, never cascade-delete the project itself.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.addColumn("projects", "active_phase_id", {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: "roadmap_items", key: "id" },
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.removeColumn("projects", "active_phase_id");
}
