import { DataTypes, type QueryInterface } from "sequelize";

/**
 * Phase 1C — minimal user identity, per ADR-0008/knowledge/05. Deliberately
 * narrow: email, display name, account status, last login. No role/
 * permission columns (ADR-0010/Task 6, separate authorization) and no
 * profile/CRUD-management fields beyond what authentication itself needs
 * (Task 8, separate authorization) — see
 * docs/task-packages/phase-1c-authentication-sessions.md §4/§5.
 *
 * Pre-provisioned-only (resolved this session, docs/project-state/setup-input-register.md):
 * a `users` row must already exist, created out-of-band by an administrator,
 * before a Google SSO login can succeed — this migration does not seed any
 * rows. Email is stored lowercased by the application layer; the UNIQUE
 * constraint below assumes that normalization, not a case-insensitive
 * column type (no `citext` extension dependency introduced for this).
 */
export async function up({ context }: { context: QueryInterface }): Promise<void> {
  await context.createTable("users", {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    display_name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    account_status: {
      type: DataTypes.ENUM("active", "disabled"),
      allowNull: false,
      defaultValue: "active",
    },
    last_login_at: {
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
    /** Nullable — non-null means soft-deleted (offboarded staff), per ADR-0016. */
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  });
}

export async function down({ context }: { context: QueryInterface }): Promise<void> {
  // The explicit `{}` works around a Sequelize bug: when a Model with a
  // matching tableName is registered on this connection (as
  // packages/database/src/auth/models.ts's `getAuthModels` does),
  // Postgres's `dropTable` tries its own automatic ENUM-column cleanup and
  // crashes on `options.supportsSearchPath = ...` if `options` is
  // `undefined` — see sequelize/lib/dialects/postgres/query-interface.js.
  await context.dropTable("users", {});
  // Sequelize does not drop the native Postgres ENUM type it created for an
  // ENUM column on dropTable — left dangling, it collides with the next up().
  await context.sequelize.query('DROP TYPE IF EXISTS "enum_users_account_status";');
}
