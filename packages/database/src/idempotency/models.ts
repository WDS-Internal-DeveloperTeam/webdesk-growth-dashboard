import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface IdempotencyModels {
  readonly IdempotencyKey: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, IdempotencyModels>();

export function getIdempotencyModels(sequelize: Sequelize = getConnection()): IdempotencyModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const IdempotencyKey = sequelize.define(
    "IdempotencyKey",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      scope: { type: DataTypes.STRING(64), allowNull: false },
      idempotencyKey: { type: DataTypes.STRING(255), allowNull: false },
      resourceType: { type: DataTypes.STRING(64), allowNull: true },
      action: { type: DataTypes.STRING(64), allowNull: true },
      requesterUserId: { type: DataTypes.UUID, allowNull: true },
      processingState: {
        type: DataTypes.ENUM("pending", "completed", "failed"),
        allowNull: false,
        defaultValue: "pending",
      },
      resultReference: { type: DataTypes.STRING(255), allowNull: true },
      expiresAt: { type: DataTypes.DATE, allowNull: true },
    },
    {
      tableName: "idempotency_keys",
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );

  const models: IdempotencyModels = { IdempotencyKey };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests`. */
export function resetIdempotencyModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
