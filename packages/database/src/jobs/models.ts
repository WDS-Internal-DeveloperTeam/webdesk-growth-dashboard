import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface JobModels {
  readonly Job: ModelStatic<Model>;
  readonly JobAttempt: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, JobModels>();

export function getJobModels(sequelize: Sequelize = getConnection()): JobModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const Job = sequelize.define(
    "Job",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      jobType: { type: DataTypes.STRING(64), allowNull: false },
      projectId: { type: DataTypes.UUID, allowNull: true },
      resourceType: { type: DataTypes.STRING(64), allowNull: true },
      resourceId: { type: DataTypes.STRING(128), allowNull: true },
      requestedByUserId: { type: DataTypes.UUID, allowNull: true },
      status: {
        type: DataTypes.ENUM(
          "pending",
          "queued",
          "running",
          "retrying",
          "succeeded",
          "failed",
          "cancelled",
          "expired",
        ),
        allowNull: false,
        defaultValue: "pending",
      },
      progress: { type: DataTypes.INTEGER, allowNull: true },
      currentStep: { type: DataTypes.STRING(128), allowNull: true },
      idempotencyKey: { type: DataTypes.STRING(255), allowNull: true },
      retryPolicy: { type: DataTypes.JSONB, allowNull: true },
      attemptCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      maxAttempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      timeoutSeconds: { type: DataTypes.INTEGER, allowNull: true },
      scheduledAt: { type: DataTypes.DATE, allowNull: true },
      startedAt: { type: DataTypes.DATE, allowNull: true },
      finishedAt: { type: DataTypes.DATE, allowNull: true },
      heartbeatAt: { type: DataTypes.DATE, allowNull: true },
      cancellationState: { type: DataTypes.STRING(32), allowNull: true },
      failureCode: { type: DataTypes.STRING(64), allowNull: true },
      failureCategory: { type: DataTypes.STRING(32), allowNull: true },
      failureSummary: { type: DataTypes.TEXT, allowNull: true },
      nextRetryAt: { type: DataTypes.DATE, allowNull: true },
      workerIdentity: { type: DataTypes.STRING(128), allowNull: true },
      correlationId: { type: DataTypes.UUID, allowNull: true },
      retentionCategory: { type: DataTypes.STRING(32), allowNull: true },
    },
    {
      tableName: "jobs",
      underscored: true,
      timestamps: true,
    },
  );

  const JobAttempt = sequelize.define(
    "JobAttempt",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      jobId: { type: DataTypes.UUID, allowNull: false },
      attemptNumber: { type: DataTypes.INTEGER, allowNull: false },
      startedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      finishedAt: { type: DataTypes.DATE, allowNull: true },
      handler: { type: DataTypes.STRING(128), allowNull: true },
      result: { type: DataTypes.STRING(16), allowNull: true },
      failureCategory: { type: DataTypes.STRING(32), allowNull: true },
      failureSummary: { type: DataTypes.TEXT, allowNull: true },
      retryDecision: { type: DataTypes.STRING(32), allowNull: true },
      correlationId: { type: DataTypes.UUID, allowNull: true },
      evidenceReference: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      tableName: "job_attempts",
      underscored: true,
      timestamps: true,
      updatedAt: false,
    },
  );

  const models: JobModels = { Job, JobAttempt };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests`. */
export function resetJobModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
