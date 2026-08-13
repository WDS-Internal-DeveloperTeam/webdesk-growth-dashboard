import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The generic legal/retention hold model (brief §21) — suspends deletion
 * eligibility for either one specific record (`resource_type`/
 * `resource_id`, polymorphic and unconstrained, same `audit_events.entity_id`
 * precedent) or an entire retention category (`category_key`, a real FK
 * into `retention_policies`). "Do not silently release a hold" is enforced
 * structurally: `release_reason` is required at the application layer
 * before `status` can move to `released` — see `RetentionHoldService`.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("retention_holds", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    scope: {
      type: DataTypes.ENUM("entity", "category"),
      allowNull: false,
    },
    resource_type: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    resource_id: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    category_key: {
      type: DataTypes.STRING(64),
      allowNull: true,
      references: { model: "retention_policies", key: "category_key" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    reason_category: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    created_by_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "RESTRICT",
      onUpdate: "CASCADE",
    },
    approved_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    start_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    /** Null means indefinite. */
    end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "released"),
      allowNull: false,
      defaultValue: "active",
    },
    release_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    released_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    released_at: {
      type: DataTypes.DATE,
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

  // Each branch also requires the OTHER scope's fields to be NULL — without that, a row could
  // satisfy the 'entity' branch (resource_type/resource_id set) while ALSO carrying a category_key,
  // a "hybrid" row neither branch alone rejects. Such a row would be picked up by
  // `findActiveForCategory` even though it was created as an entity-scoped hold, silently
  // widening which resources a category-scoped hold suspends deletion for.
  await context.sequelize.query(
    `ALTER TABLE retention_holds
       ADD CONSTRAINT retention_holds_scope_shape CHECK (
         (scope = 'entity' AND resource_type IS NOT NULL AND resource_id IS NOT NULL AND category_key IS NULL)
         OR (scope = 'category' AND category_key IS NOT NULL AND resource_type IS NULL AND resource_id IS NULL)
       );`,
  );

  await context.addIndex("retention_holds", ["status"], { name: "retention_holds_status_idx" });
  await context.addIndex("retention_holds", ["resource_type", "resource_id"], {
    name: "retention_holds_resource_idx",
  });
  await context.addIndex("retention_holds", ["category_key"], {
    name: "retention_holds_category_key_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("retention_holds", {});
  await context.sequelize.query(`DROP TYPE IF EXISTS "enum_retention_holds_scope";`);
  await context.sequelize.query(`DROP TYPE IF EXISTS "enum_retention_holds_status";`);
}
