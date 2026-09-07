import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface IntegrationsModels {
  readonly Integration: ModelStatic<Model>;
  readonly IntegrationEnvironment: ModelStatic<Model>;
  readonly WebhookEvent: ModelStatic<Model>;
  readonly SecretMetadata: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, IntegrationsModels>();

const STATUS_VALUES = ["connected", "disconnected", "error", "not_configured"] as const;

export function getIntegrationsModels(sequelize: Sequelize = getConnection()): IntegrationsModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const Integration = sequelize.define(
    "Integration",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      provider: {
        type: DataTypes.ENUM(
          "github",
          "wordpress",
          "vercel_blob",
          "postgresql",
          "smtp",
          "sentry",
          "uptime_monitor",
          "vulnerability_scanner",
          "upstash",
          "other",
        ),
        allowNull: false,
      },
      displayName: { type: DataTypes.STRING(255), allowNull: false },
      status: {
        type: DataTypes.ENUM(...STATUS_VALUES),
        allowNull: false,
        defaultValue: "not_configured",
      },
      configReference: { type: DataTypes.TEXT, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      lastVerifiedAt: { type: DataTypes.DATE, allowNull: true },
      lastVerifiedByUserId: { type: DataTypes.UUID, allowNull: true },
      lastVerificationResult: {
        type: DataTypes.ENUM("success", "failure", "unknown"),
        allowNull: true,
      },
      lastVerificationNotes: { type: DataTypes.TEXT, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { tableName: "integrations", underscored: true, timestamps: true },
  );

  const IntegrationEnvironment = sequelize.define(
    "IntegrationEnvironment",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      integrationId: { type: DataTypes.UUID, allowNull: false },
      environmentName: { type: DataTypes.STRING(255), allowNull: false },
      status: {
        type: DataTypes.ENUM(...STATUS_VALUES),
        allowNull: false,
        defaultValue: "not_configured",
      },
      configReference: { type: DataTypes.TEXT, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      lastVerifiedAt: { type: DataTypes.DATE, allowNull: true },
    },
    { tableName: "integration_environments", underscored: true, timestamps: true },
  );

  const WebhookEvent = sequelize.define(
    "WebhookEvent",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      integrationId: { type: DataTypes.UUID, allowNull: true },
      eventType: { type: DataTypes.STRING(255), allowNull: false },
      receivedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      payloadSummary: { type: DataTypes.TEXT, allowNull: true },
      processingStatus: {
        type: DataTypes.ENUM("received", "processed", "failed"),
        allowNull: false,
        defaultValue: "received",
      },
      errorMessage: { type: DataTypes.TEXT, allowNull: true },
    },
    // `webhook_events` has no `updated_at` column — immutable, no update route exists at all
    // (`updatedAt: false` keeps `createdAt` while disabling only the `updated_at` column/timestamp).
    { tableName: "webhook_events", underscored: true, timestamps: true, updatedAt: false },
  );

  const SecretMetadata = sequelize.define(
    "SecretMetadata",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      integrationId: { type: DataTypes.UUID, allowNull: false },
      secretName: { type: DataTypes.STRING(255), allowNull: false },
      storageLocation: { type: DataTypes.TEXT, allowNull: false },
      lastRotatedAt: { type: DataTypes.DATE, allowNull: true },
      rotationDueAt: { type: DataTypes.DATE, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: "secret_metadata", underscored: true, timestamps: true },
  );

  const models: IntegrationsModels = {
    Integration,
    IntegrationEnvironment,
    WebhookEvent,
    SecretMetadata,
  };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  brand-library/models.ts's own `resetBrandLibraryModelsForTests`. */
export function resetIntegrationsModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
