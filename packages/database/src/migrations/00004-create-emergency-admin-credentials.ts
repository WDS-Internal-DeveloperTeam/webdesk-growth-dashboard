import { DataTypes, type QueryInterface } from "sequelize";

/**
 * ADR-0009 — restricted local emergency-administrator authentication.
 * `password_hash` is an argon2id-encoded hash string (algorithm/params/salt
 * self-describing, per argon2's own encoded-hash format — no separate salt
 * column needed). `totp_secret_encrypted` packs
 * `${ivHex}:${authTagHex}:${ciphertextHex}` from AES-256-GCM
 * (`apps/dashboard-api/src/auth/crypto`) — the plaintext TOTP secret is
 * never persisted (NODE-103, knowledge/05).
 *
 * Deliberately does NOT duplicate lockout counters here — all lockout/rate-
 * limit state lives centrally in `auth_lockout_state` (00006), scoped per
 * login-flow-stage, so there is exactly one place that tracks failed
 * attempts instead of two competing counters.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("emergency_admin_credentials", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    password_hash: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    totp_secret_encrypted: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    totp_enrolled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "disabled"),
      allowNull: false,
      defaultValue: "active",
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
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  // See 00002-create-users.ts's down() comment for why `{}` is required.
  await context.dropTable("emergency_admin_credentials", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_emergency_admin_credentials_status";');
}
