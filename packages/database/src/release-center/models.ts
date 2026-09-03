import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface ReleaseCenterModels {
  readonly Release: ModelStatic<Model>;
  readonly ReleaseArtifact: ModelStatic<Model>;
  readonly ReleaseApproval: ModelStatic<Model>;
  readonly Deployment: ModelStatic<Model>;
  readonly SmokeTest: ModelStatic<Model>;
  readonly RollbackRecord: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, ReleaseCenterModels>();

const RELEASE_STATUS_VALUES = [
  "proposed",
  "checks_running",
  "checks_failed",
  "ready_for_staging",
  "staging_deployed",
  "staging_verification",
  "verification_failed",
  "staging_approved",
  "production_approval",
  "production_deployed",
  "production_verification",
  "completed",
  "hotfix_required",
  "rolled_back",
] as const;

export function getReleaseCenterModels(
  sequelize: Sequelize = getConnection(),
): ReleaseCenterModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const Release = sequelize.define(
    "Release",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      releaseType: {
        type: DataTypes.ENUM("staging", "production", "hotfix", "rollback"),
        allowNull: false,
      },
      title: { type: DataTypes.STRING(255), allowNull: false },
      status: {
        type: DataTypes.ENUM(...RELEASE_STATUS_VALUES),
        allowNull: false,
        defaultValue: "proposed",
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
      hotfixReason: { type: DataTypes.TEXT, allowNull: true },
      assignedDeveloperUserId: { type: DataTypes.UUID, allowNull: true },
      assignedReviewerUserId: { type: DataTypes.UUID, allowNull: true },
      productionApproverUserId: { type: DataTypes.UUID, allowNull: true },
      stagingDeployedAt: { type: DataTypes.DATE, allowNull: true },
      stagingVerifiedAt: { type: DataTypes.DATE, allowNull: true },
      productionDeployedAt: { type: DataTypes.DATE, allowNull: true },
      productionVerifiedAt: { type: DataTypes.DATE, allowNull: true },
      completedAt: { type: DataTypes.DATE, allowNull: true },
      hotfixRequiredAt: { type: DataTypes.DATE, allowNull: true },
      rolledBackAt: { type: DataTypes.DATE, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "releases", underscored: true, timestamps: true },
  );

  const ReleaseArtifact = sequelize.define(
    "ReleaseArtifact",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      releaseId: { type: DataTypes.UUID, allowNull: false },
      projectId: { type: DataTypes.UUID, allowNull: false },
      repoOwner: { type: DataTypes.STRING(255), allowNull: false },
      repoName: { type: DataTypes.STRING(255), allowNull: false },
      commitSha: { type: DataTypes.STRING(40), allowNull: false },
      prUrl: { type: DataTypes.TEXT, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "release_artifacts", underscored: true, timestamps: true },
  );

  const ReleaseApproval = sequelize.define(
    "ReleaseApproval",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      releaseId: { type: DataTypes.UUID, allowNull: false },
      projectId: { type: DataTypes.UUID, allowNull: false },
      approvalStage: { type: DataTypes.ENUM("staging", "production"), allowNull: false },
      decision: {
        type: DataTypes.ENUM("approved", "rejected", "hotfix_required"),
        allowNull: false,
      },
      decidedByUserId: { type: DataTypes.UUID, allowNull: true },
      decidedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: "release_approvals", underscored: true, timestamps: true },
  );

  const Deployment = sequelize.define(
    "Deployment",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      releaseId: { type: DataTypes.UUID, allowNull: false },
      projectId: { type: DataTypes.UUID, allowNull: false },
      environment: { type: DataTypes.ENUM("staging", "production"), allowNull: false },
      outcome: { type: DataTypes.ENUM("succeeded", "failed"), allowNull: false },
      deployedByUserId: { type: DataTypes.UUID, allowNull: true },
      deployedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: "deployments", underscored: true, timestamps: true },
  );

  const SmokeTest = sequelize.define(
    "SmokeTest",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      releaseId: { type: DataTypes.UUID, allowNull: false },
      projectId: { type: DataTypes.UUID, allowNull: false },
      environment: { type: DataTypes.ENUM("staging", "production"), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      result: { type: DataTypes.ENUM("passed", "failed"), allowNull: false },
      ranAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: "smoke_tests", underscored: true, timestamps: true },
  );

  const RollbackRecord = sequelize.define(
    "RollbackRecord",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      releaseId: { type: DataTypes.UUID, allowNull: false },
      projectId: { type: DataTypes.UUID, allowNull: false },
      rolledBackSha: { type: DataTypes.STRING(40), allowNull: false },
      reason: { type: DataTypes.TEXT, allowNull: false },
      replacementReleaseId: { type: DataTypes.UUID, allowNull: true },
      rolledBackByUserId: { type: DataTypes.UUID, allowNull: true },
      rolledBackAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: "rollback_records", underscored: true, timestamps: true },
  );

  const models: ReleaseCenterModels = {
    Release,
    ReleaseArtifact,
    ReleaseApproval,
    Deployment,
    SmokeTest,
    RollbackRecord,
  };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors `technical-center/models.ts`'s own
 *  `resetTechnicalCenterModelsForTests`. */
export function resetReleaseCenterModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
