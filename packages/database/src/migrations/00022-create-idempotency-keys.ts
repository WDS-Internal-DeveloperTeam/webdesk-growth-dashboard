import { DataTypes, type QueryInterface } from "sequelize";

/**
 * The reusable idempotency primitive (brief §11) — DB-backed, not
 * in-process memory, so it works correctly across Vercel Functions'
 * per-invocation isolation and any future Vercel Queues/Workflows consumer
 * (§11: "the design must work with Vercel Functions and future Vercel
 * Queues/Workflows... Do not integrate those external queue systems yet").
 *
 * Keyed on `(scope, idempotency_key)`, not the key alone — `scope`
 * namespaces the key so two unrelated operations can safely reuse the same
 * literal value (e.g. two different job types both receiving a client
 * request with `idempotency_key = "abc"`).
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("idempotency_keys", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    scope: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    idempotency_key: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    resource_type: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    requester_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "users", key: "id" },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    },
    processing_state: {
      type: DataTypes.ENUM("pending", "completed", "failed"),
      allowNull: false,
      defaultValue: "pending",
    },
    /** e.g. the id of the job this reservation created — how a duplicate request finds the original result. */
    result_reference: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });

  await context.addConstraint("idempotency_keys", {
    fields: ["scope", "idempotency_key"],
    type: "unique",
    name: "idempotency_keys_scope_key_unique",
  });
  await context.addIndex("idempotency_keys", ["expires_at"], {
    name: "idempotency_keys_expires_at_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("idempotency_keys", {});
  await context.sequelize.query(`DROP TYPE IF EXISTS "enum_idempotency_keys_processing_state";`);
}
