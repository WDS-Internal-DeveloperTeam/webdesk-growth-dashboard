import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

/**
 * Sequelize model definitions for the Phase 1C auth schema
 * (src/migrations/00002-00008). Defined lazily and cached per Sequelize
 * instance (mirrors connection.ts's module-scope caching) so repeated calls
 * within one warm Vercel Function invocation reuse the same model objects
 * instead of re-registering them — Sequelize throws if you `define()` the
 * same table name twice against the same connection.
 */
export interface AuthModels {
  readonly User: ModelStatic<Model>;
  readonly ExternalAuthIdentity: ModelStatic<Model>;
  readonly EmergencyAdminCredential: ModelStatic<Model>;
  readonly Session: ModelStatic<Model>;
  readonly AuthLockoutState: ModelStatic<Model>;
  readonly RecoveryRequest: ModelStatic<Model>;
  readonly AuthEvent: ModelStatic<Model>;
  readonly SessionExchangeCode: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, AuthModels>();

export function getAuthModels(sequelize: Sequelize = getConnection()): AuthModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const User = sequelize.define(
    "User",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      email: { type: DataTypes.STRING, allowNull: false, unique: true },
      displayName: { type: DataTypes.STRING, allowNull: false },
      accountStatus: {
        type: DataTypes.ENUM("active", "disabled"),
        allowNull: false,
        defaultValue: "active",
      },
      lastLoginAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: "users", underscored: true, timestamps: true, paranoid: true },
  );

  const ExternalAuthIdentity = sequelize.define(
    "ExternalAuthIdentity",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      provider: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "google" },
      providerSubjectId: { type: DataTypes.STRING, allowNull: false },
      workspaceDomain: { type: DataTypes.STRING, allowNull: false },
    },
    {
      tableName: "external_auth_identities",
      underscored: true,
      timestamps: true,
      paranoid: true,
    },
  );

  const EmergencyAdminCredential = sequelize.define(
    "EmergencyAdminCredential",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false, unique: true },
      passwordHash: { type: DataTypes.TEXT, allowNull: false },
      totpSecretEncrypted: { type: DataTypes.TEXT, allowNull: false },
      totpEnrolledAt: { type: DataTypes.DATE, allowNull: true },
      status: {
        type: DataTypes.ENUM("active", "disabled"),
        allowNull: false,
        defaultValue: "active",
      },
    },
    {
      tableName: "emergency_admin_credentials",
      underscored: true,
      timestamps: true,
      paranoid: true,
    },
  );

  const Session = sequelize.define(
    "Session",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      authMethod: { type: DataTypes.ENUM("google_sso", "emergency_local"), allowNull: false },
      requiresMfa: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      mfaVerifiedAt: { type: DataTypes.DATE, allowNull: true },
      lastActivityAt: { type: DataTypes.DATE, allowNull: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
      revokedReason: {
        type: DataTypes.ENUM(
          "user-initiated",
          "role-change",
          "admin-forced",
          "security-incident",
          "expired",
        ),
        allowNull: true,
      },
      ipHash: { type: DataTypes.STRING(64), allowNull: true },
      userAgent: { type: DataTypes.STRING(512), allowNull: true },
    },
    { tableName: "sessions", underscored: true, timestamps: true, paranoid: false },
  );

  const AuthLockoutState = sequelize.define(
    "AuthLockoutState",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      scope: { type: DataTypes.STRING(64), allowNull: false },
      identifier: { type: DataTypes.STRING(256), allowNull: false },
      failedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      firstFailedAt: { type: DataTypes.DATE, allowNull: true },
      lockedUntil: { type: DataTypes.DATE, allowNull: true },
      lastAttemptAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: "auth_lockout_state", underscored: true, timestamps: true, paranoid: false },
  );

  const RecoveryRequest = sequelize.define(
    "RecoveryRequest",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      targetUserId: { type: DataTypes.UUID, allowNull: false },
      requestedByUserId: { type: DataTypes.UUID, allowNull: true },
      reason: { type: DataTypes.TEXT, allowNull: false },
      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected"),
        allowNull: false,
        defaultValue: "pending",
      },
      decidedByUserId: { type: DataTypes.UUID, allowNull: true },
      decidedAt: { type: DataTypes.DATE, allowNull: true },
      decisionNote: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: "recovery_requests", underscored: true, timestamps: true, paranoid: false },
  );

  const AuthEvent = sequelize.define(
    "AuthEvent",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      eventType: { type: DataTypes.STRING(64), allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: true },
      sessionId: { type: DataTypes.UUID, allowNull: true },
      authMethod: { type: DataTypes.STRING(32), allowNull: true },
      success: { type: DataTypes.BOOLEAN, allowNull: false },
      reason: { type: DataTypes.STRING(128), allowNull: true },
      ipHash: { type: DataTypes.STRING(64), allowNull: true },
      userAgent: { type: DataTypes.STRING(512), allowNull: true },
    },
    {
      tableName: "auth_events",
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );

  const SessionExchangeCode = sequelize.define(
    "SessionExchangeCode",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      authMethod: { type: DataTypes.ENUM("google_sso", "emergency_local"), allowNull: false },
      codeHash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      redeemedAt: { type: DataTypes.DATE, allowNull: true },
      ipHash: { type: DataTypes.STRING(64), allowNull: true },
      userAgent: { type: DataTypes.STRING(512), allowNull: true },
    },
    {
      tableName: "session_exchange_codes",
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );

  const models: AuthModels = {
    User,
    ExternalAuthIdentity,
    EmergencyAdminCredential,
    Session,
    AuthLockoutState,
    RecoveryRequest,
    AuthEvent,
    SessionExchangeCode,
  };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests`. */
export function resetAuthModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
