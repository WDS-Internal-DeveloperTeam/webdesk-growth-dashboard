import { DataTypes, type Model, type ModelStatic, type Sequelize } from "sequelize";
import { getConnection } from "../connection.js";

export interface ProofAndClaimsLibraryModels {
  readonly ProofClaim: ModelStatic<Model>;
  readonly ClaimSource: ModelStatic<Model>;
}

const cache = new WeakMap<Sequelize, ProofAndClaimsLibraryModels>();

export function getProofAndClaimsLibraryModels(
  sequelize: Sequelize = getConnection(),
): ProofAndClaimsLibraryModels {
  const cached = cache.get(sequelize);
  if (cached) {
    return cached;
  }

  const ProofClaim = sequelize.define(
    "ProofClaim",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      publicId: { type: DataTypes.STRING(64), allowNull: false },
      claim: { type: DataTypes.TEXT, allowNull: false },
      claimType: { type: DataTypes.STRING(255), allowNull: true },
      beforeValue: { type: DataTypes.STRING(255), allowNull: true },
      afterValue: { type: DataTypes.STRING(255), allowNull: true },
      verificationStatus: {
        type: DataTypes.ENUM("unverified", "pending", "verified"),
        allowNull: false,
        defaultValue: "unverified",
      },
      approvedWording: { type: DataTypes.TEXT, allowNull: true },
      restrictions: { type: DataTypes.TEXT, allowNull: true },
      expiryReviewDate: { type: DataTypes.DATEONLY, allowNull: true },
      relatedServiceIds: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      relatedCaseStudyIds: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      relatedPageIds: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
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
      createdBy: { type: DataTypes.UUID, allowNull: true },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
    },
    { tableName: "proof_claims", underscored: true, timestamps: true },
  );

  const ClaimSource = sequelize.define(
    "ClaimSource",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      claimId: { type: DataTypes.UUID, allowNull: false },
      source: { type: DataTypes.TEXT, allowNull: false },
      sourceUrl: { type: DataTypes.TEXT, allowNull: true },
    },
    { tableName: "claim_sources", underscored: true, timestamps: true },
  );

  const models: ProofAndClaimsLibraryModels = { ProofClaim, ClaimSource };
  cache.set(sequelize, models);
  return models;
}

/** Test-only escape hatch, mirrors connection.ts's `resetConnectionForTests` and
 *  persona-library/models.ts's own `resetPersonaLibraryModelsForTests`. */
export function resetProofAndClaimsLibraryModelsForTests(sequelize: Sequelize): void {
  cache.delete(sequelize);
}
