import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface ProjectsModels {
  readonly Project: ModelStatic<Model>;
  readonly ProjectEnvironment: ModelStatic<Model>;
  readonly ProjectRepository: ModelStatic<Model>;
  readonly ProjectUser: ModelStatic<Model>;
  readonly ProjectObjective: ModelStatic<Model>;
  readonly RoadmapItem: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, ProjectsModels>();

export function getProjectsModels(sequelize: Sequelize = getConnection()): ProjectsModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const Project = sequelize.define(
    "Project",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM("active", "paused", "archived"),
        allowNull: false,
        defaultValue: "active",
      },
      activePhaseId: { type: DataTypes.UUID, allowNull: true },
      ownerUserId: { type: DataTypes.UUID, allowNull: true },
      confidentiality: {
        type: DataTypes.ENUM("public", "internal", "confidential", "restricted"),
        allowNull: false,
        defaultValue: "internal",
      },
      retentionCategory: { type: DataTypes.STRING(64), allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "projects", underscored: true, timestamps: true },
  );

  const ProjectEnvironment = sequelize.define(
    "ProjectEnvironment",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(64), allowNull: false },
      url: { type: DataTypes.STRING(500), allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "project_environments", underscored: true, timestamps: true },
  );

  const ProjectRepository = sequelize.define(
    "ProjectRepository",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      repoOwner: { type: DataTypes.STRING(255), allowNull: false },
      repoName: { type: DataTypes.STRING(255), allowNull: false },
      defaultBranch: { type: DataTypes.STRING(255), allowNull: false, defaultValue: "main" },
      notes: { type: DataTypes.TEXT, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "project_repositories", underscored: true, timestamps: true },
  );

  const ProjectUser = sequelize.define(
    "ProjectUser",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      addedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      addedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "project_users", underscored: true, timestamps: false },
  );

  const ProjectObjective = sequelize.define(
    "ProjectObjective",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: false },
      status: {
        type: DataTypes.ENUM("open", "complete"),
        allowNull: false,
        defaultValue: "open",
      },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "project_objectives", underscored: true, timestamps: true },
  );

  const RoadmapItem = sequelize.define(
    "RoadmapItem",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      projectId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      sequence: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      status: {
        type: DataTypes.ENUM("not_started", "active", "complete", "skipped"),
        allowNull: false,
        defaultValue: "not_started",
      },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "roadmap_items", underscored: true, timestamps: true },
  );

  const models: ProjectsModels = {
    Project,
    ProjectEnvironment,
    ProjectRepository,
    ProjectUser,
    ProjectObjective,
    RoadmapItem,
  };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests`. */
export function resetProjectsModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
