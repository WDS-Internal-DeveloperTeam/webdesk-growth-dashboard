import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Foundation only, per ADR-0009's separation-of-duties requirement
 * (knowledge/05: "a single administrator cannot recover their own or
 * another's locked emergency account unilaterally"). `decided_by_user_id`
 * must differ from `target_user_id` — enforced at the application layer
 * (a CHECK constraint can't express "different from the row referenced by
 * another FK" portably); tested directly
 * (apps/dashboard-api/src/auth/recovery).
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("recovery_requests", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    target_user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    requested_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    },
    decided_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    decided_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    decision_note: {
      type: DataTypes.TEXT,
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

  await context.addIndex("recovery_requests", ["target_user_id"], {
    name: "recovery_requests_target_user_id_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  // See 00002-create-users.ts's down() comment for why `{}` is required.
  await context.dropTable("recovery_requests", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_recovery_requests_status";');
}
