/**
 * The Proof and Claims Library module foundation — persistence-layer shapes for `proof_claims`
 * and `claim_sources` (migration `00054`). Organization-wide, not project-scoped — these describe
 * WebDesk Solution's own claim/evidence catalog, not something that varies per client project.
 */

export type ProofClaimVerificationStatus = "unverified" | "pending" | "verified";

export type ProofClaimApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/** The parent entity. `relatedServiceIds` is existence-validated against the real `services`
 *  table (`ProofClaimsService.assertServiceIdsExist()`), mirroring Persona Library's own
 *  `relatedServiceIds` precedent exactly. `relatedCaseStudyIds`/`relatedPageIds` are unvalidated
 *  identifier lists, not foreign keys — `case_study_studio`/`page_inventory` don't exist yet,
 *  mirroring Service Library's own `icpIds`/`relatedPageIds`/`relatedCaseStudyIds` precedent. */
export interface ProofClaimEntity {
  readonly id: string;
  readonly publicId: string;
  readonly claim: string;
  readonly claimType: string | null;
  readonly beforeValue: string | null;
  readonly afterValue: string | null;
  readonly verificationStatus: ProofClaimVerificationStatus;
  readonly approvedWording: string | null;
  readonly restrictions: string | null;
  readonly expiryReviewDate: string | null;
  readonly relatedServiceIds: readonly string[];
  readonly relatedCaseStudyIds: readonly string[];
  readonly relatedPageIds: readonly string[];
  readonly approvalStatus: ProofClaimApprovalStatus;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A real one-to-many child of `ProofClaimEntity` — `04_Data_Model_and_Ownership.md:119-120`
 *  explicitly names `claim_sources` as its own table, not a JSONB array on the parent. */
export interface ClaimSourceEntity {
  readonly id: string;
  readonly claimId: string;
  readonly source: string;
  readonly sourceUrl: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
