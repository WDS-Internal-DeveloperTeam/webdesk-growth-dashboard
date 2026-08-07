import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Generic, DB-backed lockout/rate-limit tracking (base skill
 * `security/01-owasp-api.md` baseline, applied per knowledge/05) —
 * database-backed, not in-memory, because Vercel Functions are stateless
 * (a per-process counter would reset on every cold start and never
 * coordinate across concurrent invocations). `scope` + `identifier`
 * together name what's being rate-limited: e.g. `("emergency_login",
 * "admin@webdesksolution.com")` or `("emergency_totp", "<session id>")` —
 * one row per scope+identifier pair, upserted on every attempt. No
 * soft-delete: these are transient counters with no retained-history value.
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("auth_lockout_state", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    scope: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    identifier: {
      type: DataTypes.STRING(256),
      allowNull: false,
    },
    failed_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    first_failed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    locked_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    last_attempt_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
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

  await context.addIndex("auth_lockout_state", ["scope", "identifier"], {
    unique: true,
    name: "auth_lockout_state_scope_identifier_unique",
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  await context.dropTable("auth_lockout_state");
}
