import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface ServiceLibraryModels {
  readonly ServiceCategory: ModelStatic<Model>;
  readonly Service: ModelStatic<Model>;
  readonly Deliverable: ModelStatic<Model>;
  readonly PlatformTechnology: ModelStatic<Model>;
  readonly EngagementModel: ModelStatic<Model>;
  readonly ServiceDeliverable: ModelStatic<Model>;
  readonly ServicePlatform: ModelStatic<Model>;
  readonly ServiceEngagementModel: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, ServiceLibraryModels>();

export function getServiceLibraryModels(
  sequelize: Sequelize = getConnection(),
): ServiceLibraryModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const ServiceCategory = sequelize.define(
    "ServiceCategory",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      parentCategoryId: { type: DataTypes.UUID, allowNull: true },
      publicDescription: { type: DataTypes.TEXT, allowNull: true },
      internalDescription: { type: DataTypes.TEXT, allowNull: true },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "service_categories", underscored: true, timestamps: true },
  );

  const Service = sequelize.define(
    "Service",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      canonicalName: { type: DataTypes.STRING(255), allowNull: false },
      publicName: { type: DataTypes.STRING(255), allowNull: true },
      categoryId: { type: DataTypes.UUID, allowNull: false },
      parentServiceId: { type: DataTypes.UUID, allowNull: true },
      shortPublicDescription: { type: DataTypes.TEXT, allowNull: true },
      audience: { type: DataTypes.TEXT, allowNull: true },
      problems: { type: DataTypes.TEXT, allowNull: true },
      capabilities: { type: DataTypes.TEXT, allowNull: true },
      outcomes: { type: DataTypes.TEXT, allowNull: true },
      exclusions: { type: DataTypes.TEXT, allowNull: true },
      internalDescription: { type: DataTypes.TEXT, allowNull: true },
      icpIds: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false, defaultValue: [] },
      relatedPageIds: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      relatedCaseStudyIds: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      confidentiality: {
        type: DataTypes.ENUM("public", "internal", "restricted"),
        allowNull: false,
        defaultValue: "internal",
      },
      publicationStatus: {
        type: DataTypes.ENUM("draft", "published", "unpublished"),
        allowNull: false,
        defaultValue: "draft",
      },
      approvalStatus: {
        type: DataTypes.ENUM(
          "draft",
          "submitted",
          "under_review",
          "approved",
          "revision_requested",
          "rejected",
          "superseded",
          "archived",
        ),
        allowNull: false,
        defaultValue: "draft",
      },
      ownerUserId: { type: DataTypes.UUID, allowNull: true },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "services", underscored: true, timestamps: true },
  );

  const Deliverable = sequelize.define(
    "Deliverable",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: "deliverables", underscored: true, timestamps: true },
  );

  const PlatformTechnology = sequelize.define(
    "PlatformTechnology",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      platformType: { type: DataTypes.STRING(64), allowNull: true },
      certifiedPartnership: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { tableName: "platforms_technologies", underscored: true, timestamps: true },
  );

  const EngagementModel = sequelize.define(
    "EngagementModel",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      preferred: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      approvalRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { tableName: "engagement_models", underscored: true, timestamps: true },
  );

  // Join tables have only `created_at` (no `updated_at` — a row is created or deleted, never
  // edited in place), so `timestamps: false` plus an explicit `createdAt` attribute, matching
  // `ProjectUser`'s own `timestamps: false` + explicit `addedAt` pattern.
  const ServiceDeliverable = sequelize.define(
    "ServiceDeliverable",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      serviceId: { type: DataTypes.UUID, allowNull: false },
      deliverableId: { type: DataTypes.UUID, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: "service_deliverables", underscored: true, timestamps: false },
  );

  const ServicePlatform = sequelize.define(
    "ServicePlatform",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      serviceId: { type: DataTypes.UUID, allowNull: false },
      platformId: { type: DataTypes.UUID, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: "service_platforms", underscored: true, timestamps: false },
  );

  const ServiceEngagementModel = sequelize.define(
    "ServiceEngagementModel",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      serviceId: { type: DataTypes.UUID, allowNull: false },
      engagementModelId: { type: DataTypes.UUID, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { tableName: "service_engagement_models", underscored: true, timestamps: false },
  );

  const models: ServiceLibraryModels = {
    ServiceCategory,
    Service,
    Deliverable,
    PlatformTechnology,
    EngagementModel,
    ServiceDeliverable,
    ServicePlatform,
    ServiceEngagementModel,
  };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests`. */
export function resetServiceLibraryModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
