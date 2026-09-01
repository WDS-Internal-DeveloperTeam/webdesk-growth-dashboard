/**
 * Case Study Studio — module #23 foundation, persistence-layer shapes for `case_studies`,
 * `case_study_assets`, `case_study_consents`, and `case_study_approvals` (migration `00091`).
 * Organization-wide, not project-scoped. See
 * `docs/implementation/module-case-study-studio.md` for the full D1-D10 design account.
 */

export type CaseStudyVisibility =
  "public" | "internal_only" | "confidential" | "client_approval_required";

/** D1 — the full bespoke 14-stage lifecycle named in the canonical spec. `archived` is terminal. */
export type CaseStudyStatus =
  | "intake"
  | "upload"
  | "completeness_review"
  | "ready_for_claude"
  | "missing_information"
  | "draft"
  | "search_review"
  | "fact_confidentiality_review"
  | "internal_approval"
  | "client_approval"
  | "scheduled"
  | "published"
  | "unpublished"
  | "archived";

export type CaseStudyApprovalType = "internal" | "client";
export type CaseStudyApprovalDecision = "approved" | "rejected" | "revision_requested";

export type CaseStudyAssetRole =
  "hero_screenshot" | "logo" | "testimonial_screenshot" | "video" | "document" | "other";

export type CaseStudyConsentType = "client_publication" | "testimonial" | "logo_usage" | "other";

/** The parent entity. `relatedServiceIds` is existence-validated against the real `services`
 *  table; `relatedClaimIds` is existence-validated against the real `proof_claims` table (D2) —
 *  supersedes the canonical data-model doc's own `case_study_claims` table name. */
export interface CaseStudyEntity {
  readonly id: string;
  readonly publicId: string;
  readonly clientName: string;
  readonly projectTitle: string;
  readonly industry: string | null;
  readonly platform: string | null;
  readonly visibility: CaseStudyVisibility;
  readonly embargoDate: string | null;
  readonly challenge: string | null;
  readonly solution: string | null;
  readonly implementation: string | null;
  readonly results: string | null;
  readonly relatedServiceIds: readonly string[];
  readonly relatedClaimIds: readonly string[];
  readonly assignedReviewerUserId: string | null;
  readonly clientApprovalRequired: boolean;
  readonly status: CaseStudyStatus;
  readonly scheduledPublishAt: string | null;
  readonly publishedAt: string | null;
  readonly unpublishReason: string | null;
  readonly version: number;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** D3 — a real many-to-many join into the real, already-live `assets` table. `assetId` is
 *  existence-validated at the app layer (`AssetsService.existingAssetIds()`), not a DB-level FK —
 *  keeps this module decoupled from Asset Library's own schema/deletion lifecycle. */
export interface CaseStudyAssetEntity {
  readonly id: string;
  readonly caseStudyId: string;
  readonly assetId: string;
  readonly role: CaseStudyAssetRole;
  readonly caption: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Case-study-level consent evidence — client publication/testimonial/logo-usage consent,
 *  distinct from an individual asset's own `consent_reference` (Asset Library). */
export interface CaseStudyConsentEntity {
  readonly id: string;
  readonly caseStudyId: string;
  readonly consentType: CaseStudyConsentType;
  readonly consentEvidenceReference: string | null;
  readonly grantedBy: string | null;
  readonly grantedAt: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** A queryable decision-history log for the two approval stages (`internal_approval`/
 *  `client_approval`), mirroring Review and Approval Center's own `review_decisions` table shape. */
export interface CaseStudyApprovalEntity {
  readonly id: string;
  readonly caseStudyId: string;
  readonly approvalType: CaseStudyApprovalType;
  readonly decision: CaseStudyApprovalDecision;
  readonly decidedByUserId: string | null;
  readonly decidedAt: string;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
