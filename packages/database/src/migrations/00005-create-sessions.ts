import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Dashboard-issued sessions (knowledge/05 "Session, downstream of SSO").
 * `token_hash` stores SHA-256(opaque token) — the raw token is only ever
 * held by the browser (httpOnly cookie) and this row; a database
 * compromise alone cannot be used to hijack a live session. Maximum 7-day
 * absolute expiry enforced at the application layer against `expires_at`.
 *
 * The two-step emergency-admin flow (password, then TOTP) is modeled as a
 * single session row that starts `requires_mfa = true`, `mfa_verified_at =
 * null`, with a short `expires_at` (the pending-MFA window) — TOTP success
 * elevates it in place (`mfa_verified_at` set, `expires_at` extended to the
 * full session window) rather than creating a second table for "pending"
 * state.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("sessions", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "users", key: "id" },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    token_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    auth_method: {
      type: DataTypes.ENUM("google_sso", "emergency_local"),
      allowNull: false,
    },
    requires_mfa: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    mfa_verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_activity_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    revoked_reason: {
      type: DataTypes.ENUM(
        "user-initiated",
        "role-change",
        "admin-forced",
        "security-incident",
        "expired",
      ),
      allowNull: true,
    },
    /** SHA-256 of the client IP — data minimization (nodejs/knowledge/security/05-pii-and-compliance.md), never the raw address. */
    ip_hash: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.STRING(512),
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

  await context.addIndex("sessions", ["user_id"], { name: "sessions_user_id_idx" });
  await context.addIndex("sessions", ["expires_at"], { name: "sessions_expires_at_idx" });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  // See 00002-create-users.ts's down() comment for why `{}` is required.
  await context.dropTable("sessions", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_sessions_auth_method";');
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_sessions_revoked_reason";');
}
