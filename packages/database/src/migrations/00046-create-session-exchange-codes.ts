import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Bridges the cross-domain session-cookie gap between `dashboard-api` and
 * `dashboard-web` (two separate `*.vercel.app` projects — see
 * `cookie.util.ts`'s own doc comment on why the session cookie is host-only
 * to `dashboard-api`'s domain). After a real login completes,
 * `dashboard-api` mints one of these short-lived, single-use codes and
 * redirects the browser to a `dashboard-web` route carrying it; that route
 * redeems the code server-to-server and mints `dashboard-web` its own,
 * independent session (via `SessionService.issue()` again) — see
 * `docs/implementation/session-exchange.md`.
 *
 * Deliberately mirrors `sessions.token_hash`'s own discipline: only the
 * SHA-256 hash of the raw code is ever persisted, and the code is single-use
 * (`redeemed_at`) with a short absolute expiry, matching the OIDC
 * transaction cookie's own precedent for "must not survive more than a
 * couple of minutes."
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("session_exchange_codes", {
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
    auth_method: {
      type: DataTypes.ENUM("google_sso", "emergency_local"),
      allowNull: false,
    },
    code_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    redeemed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  });

  await context.addIndex("session_exchange_codes", ["expires_at"], {
    name: "session_exchange_codes_expires_at_idx",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  // See 00002-create-users.ts's down() comment for why `{}` is required.
  await context.dropTable("session_exchange_codes", {});
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_session_exchange_codes_auth_method";');
}
