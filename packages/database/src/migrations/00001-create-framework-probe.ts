import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Proves the migration framework end-to-end (connection, migration runner,
 * up/down reversal, CI service-container testing) without creating any real
 * business entity. `_framework_probe` is deliberately NOT `projects` or
 * `users` — creating those requires a separate, explicit authorization
 * beyond this package's own approval
 * (docs/task-packages/phase-1b-database-foundation.md §9/§24). Safe to drop
 * once a real authorized migration exists to prove the framework instead.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("_framework_probe", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    label: {
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
    /** Nullable — non-null means soft-deleted. Sequelize `paranoid` mode manages this column. */
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("_framework_probe");
}
