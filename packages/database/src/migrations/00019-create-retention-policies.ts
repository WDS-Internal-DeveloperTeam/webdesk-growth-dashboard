import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The retention-policy model (Phase 1E retention-architecture brief §19) —
 * unlike every other Phase 1E permission/module addition, this table's
 * DATA (not just its schema) is seeded in the very next migration, because
 * §20 hands down the actual approved retention values directly — there is
 * no pending business decision to wait on here, unlike RBAC grants. See
 * `docs/task-packages/phase-1e-retention-architecture.md`.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("retention_policies", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    category_key: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    display_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    retention_value: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    retention_unit: {
      type: DataTypes.ENUM("days", "years"),
      allowNull: false,
    },
    /** What the retention clock starts from for this category — e.g. "created_at", "finished_at", "closed_at", "deleted_at". Descriptive, not enforced here: computing real ages per-anchor is a per-table concern the caller resolves. */
    anchor: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "created_at",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    /** Informational, not FK-constrained — several categories (scan reports, backups, uploads) have no table yet. */
    applies_to_entity_type: {
      type: DataTypes.STRING(64),
      allowNull: true,
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

  await context.addConstraint("retention_policies", {
    fields: ["category_key"],
    type: "unique",
    name: "retention_policies_category_key_unique",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("retention_policies", {});
  await context.sequelize.query(`DROP TYPE IF EXISTS "enum_retention_policies_retention_unit";`);
}
