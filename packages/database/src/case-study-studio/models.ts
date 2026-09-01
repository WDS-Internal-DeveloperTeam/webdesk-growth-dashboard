import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface CaseStudyStudioModels {
  readonly CaseStudy: ModelStatic<Model>;
  readonly CaseStudyAsset: ModelStatic<Model>;
  readonly CaseStudyConsent: ModelStatic<Model>;
  readonly CaseStudyApproval: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, CaseStudyStudioModels>();

export function getCaseStudyStudioModels(
  sequelize: Sequelize = getConnection(),
): CaseStudyStudioModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const CaseStudy = sequelize.define(
    "CaseStudy",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      clientName: { type: DataTypes.STRING(255), allowNull: false },
      projectTitle: { type: DataTypes.STRING(255), allowNull: false },
      industry: { type: DataTypes.STRING(255), allowNull: true },
      platform: { type: DataTypes.STRING(255), allowNull: true },
      visibility: {
        type: DataTypes.ENUM("public", "internal_only", "confidential", "client_approval_required"),
        allowNull: false,
        defaultValue: "internal_only",
      },
      embargoDate: { type: DataTypes.DATEONLY, allowNull: true },
      challenge: { type: DataTypes.TEXT, allowNull: true },
      solution: { type: DataTypes.TEXT, allowNull: true },
      implementation: { type: DataTypes.TEXT, allowNull: true },
      results: { type: DataTypes.TEXT, allowNull: true },
      relatedServiceIds: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      relatedClaimIds: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      assignedReviewerUserId: { type: DataTypes.UUID, allowNull: true },
      clientApprovalRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      status: {
        type: DataTypes.ENUM(
          "intake",
          "upload",
          "completeness_review",
          "ready_for_claude",
          "missing_information",
          "draft",
          "search_review",
          "fact_confidentiality_review",
          "internal_approval",
          "client_approval",
          "scheduled",
          "published",
          "unpublished",
          "archived",
        ),
        allowNull: false,
        defaultValue: "intake",
      },
      scheduledPublishAt: { type: DataTypes.DATE, allowNull: true },
      publishedAt: { type: DataTypes.DATE, allowNull: true },
      unpublishReason: { type: DataTypes.TEXT, allowNull: true },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "case_studies", underscored: true, timestamps: true },
  );

  const CaseStudyAsset = sequelize.define(
    "CaseStudyAsset",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      caseStudyId: { type: DataTypes.UUID, allowNull: false },
      assetId: { type: DataTypes.UUID, allowNull: false },
      role: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      caption: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: "case_study_assets", underscored: true, timestamps: true },
  );

  const CaseStudyConsent = sequelize.define(
    "CaseStudyConsent",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      caseStudyId: { type: DataTypes.UUID, allowNull: false },
      consentType: { type: DataTypes.STRING(64), allowNull: false },
      consentEvidenceReference: { type: DataTypes.TEXT, allowNull: true },
      grantedBy: { type: DataTypes.STRING(255), allowNull: true },
      grantedAt: { type: DataTypes.DATE, allowNull: true },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: "case_study_consents", underscored: true, timestamps: true },
  );

  const CaseStudyApproval = sequelize.define(
    "CaseStudyApproval",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      caseStudyId: { type: DataTypes.UUID, allowNull: false },
      approvalType: { type: DataTypes.ENUM("internal", "client"), allowNull: false },
      decision: {
        type: DataTypes.ENUM("approved", "rejected", "revision_requested"),
        allowNull: false,
      },
      decidedByUserId: { type: DataTypes.UUID, allowNull: true },
      decidedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      notes: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: "case_study_approvals", underscored: true, timestamps: true },
  );

  const models: CaseStudyStudioModels = {
    CaseStudy,
    CaseStudyAsset,
    CaseStudyConsent,
    CaseStudyApproval,
  };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  proof-and-claims-library/models.ts's own `resetProofAndClaimsLibraryModelsForTests`. */
export function resetCaseStudyStudioModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
