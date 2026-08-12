import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

/**
 * Sequelize model definition for the ADR-0017 `audit_events` table
 * (migration 00018). Cached per Sequelize instance, same pattern as
 * `../auth/models.ts`/`../authz/models.ts` — `define()` throws if called
 * twice against the same connection for the same table name.
 */
export interface AuditModels {
  readonly AuditEvent: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, AuditModels>();

export function getAuditModels(sequelize: Sequelize = getConnection()): AuditModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const AuditEvent = sequelize.define(
    "AuditEvent",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      eventType: { type: DataTypes.STRING(64), allowNull: false },
      actorUserId: { type: DataTypes.UUID, allowNull: true },
      actorType: {
        type: DataTypes.ENUM("human", "system", "service_account"),
        allowNull: false,
      },
      entityType: { type: DataTypes.STRING(64), allowNull: false },
      entityId: { type: DataTypes.STRING(128), allowNull: false },
      entityVersion: { type: DataTypes.INTEGER, allowNull: true },
      action: { type: DataTypes.STRING(64), allowNull: false },
      beforeState: { type: DataTypes.JSONB, allowNull: true },
      afterState: { type: DataTypes.JSONB, allowNull: true },
      reason: { type: DataTypes.TEXT, allowNull: true },
      relatedGateOrApprovalId: { type: DataTypes.UUID, allowNull: true },
      gitCommitSha: { type: DataTypes.STRING(40), allowNull: true },
      retentionCategory: { type: DataTypes.STRING(32), allowNull: false },
      legalHold: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      legalHoldReason: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "audit_events",
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );

  const models: AuditModels = { AuditEvent };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests`. */
export function resetAuditModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
