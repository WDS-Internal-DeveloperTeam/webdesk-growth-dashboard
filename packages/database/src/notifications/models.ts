import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface NotificationModels {
  readonly Notification: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, NotificationModels>();

export function getNotificationModels(sequelize: Sequelize = getConnection()): NotificationModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const Notification = sequelize.define(
    "Notification",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      notificationType: { type: DataTypes.STRING(64), allowNull: false },
      severity: {
        type: DataTypes.ENUM("critical", "high", "medium", "low"),
        allowNull: false,
      },
      operationalArea: { type: DataTypes.STRING(64), allowNull: true },
      projectId: { type: DataTypes.UUID, allowNull: true },
      recipientUserId: { type: DataTypes.UUID, allowNull: true },
      recipientContactId: { type: DataTypes.UUID, allowNull: true },
      subject: { type: DataTypes.STRING(255), allowNull: false },
      bodyReference: { type: DataTypes.TEXT, allowNull: true },
      deliveryState: {
        type: DataTypes.ENUM(
          "queued",
          "sent_to_smtp",
          "accepted",
          "failed",
          "retrying",
          "permanently_failed",
        ),
        allowNull: false,
        defaultValue: "queued",
      },
      attemptCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      lastAttemptAt: { type: DataTypes.DATE, allowNull: true },
      failureSummary: { type: DataTypes.TEXT, allowNull: true },
      retryEligible: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      correlationId: { type: DataTypes.UUID, allowNull: true },
      relatedEntityType: { type: DataTypes.STRING(32), allowNull: true },
      relatedEntityId: { type: DataTypes.STRING(128), allowNull: true },
      retentionCategory: { type: DataTypes.STRING(32), allowNull: true },
    },
    {
      tableName: "notifications",
      underscored: true,
      timestamps: true,
    },
  );

  const models: NotificationModels = { Notification };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests`. */
export function resetNotificationModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
