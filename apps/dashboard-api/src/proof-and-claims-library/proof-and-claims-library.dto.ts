import { z } from "zod";

// Mirrors packages/database/src/proof-and-claims-library/entities.ts's ProofClaimApprovalStatus —
// identical vocabulary to Service Library's/Persona Library's own, reused verbatim.
const APPROVAL_STATUS_VALUES = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "revision_requested",
  "rejected",
  "superseded",
  "archived",
] as const;

export const proofClaimApprovalStatusSchema = z.enum(APPROVAL_STATUS_VALUES);

const VERIFICATION_STATUS_VALUES = ["unverified", "pending", "verified"] as const;
export const proofClaimVerificationStatusSchema = z.enum(VERIFICATION_STATUS_VALUES);

// These fields are plain text, not HTML — this is a backend-only pass with no dashboard-web UI
// yet, so no rich-text editor/sanitization applies here, mirroring Persona Library's own original
// backend build (before its later, separate rich-text-editor conversion pass) rather than
// conflating the two passes.
const LONG_TEXT_MAX_LENGTH = 20_000;
const longTextField = z.string().max(LONG_TEXT_MAX_LENGTH).nullish();

const shortTextField = z.string().max(255).nullish();

// Existence-validated against the real `services` table (relatedServiceIds only — see
// ProofClaimsService.assertServiceIdsExist()), mirroring Persona Library's own idListField
// exactly — `services` already exists, unlike relatedCaseStudyIds/relatedPageIds's own target
// modules. `.nullish()` so an explicit `null` can clear the field on update.
const idListField = z.array(z.string().min(1).max(128)).max(200).nullish();

// Unvalidated identifier lists — `case_study_studio`/`page_inventory` don't exist yet, mirroring
// Service Library's own icpIds/relatedPageIds/relatedCaseStudyIds precedent.
const unvalidatedIdListField = z.array(z.string().min(1).max(128)).max(200).nullish();

export const listProofClaimsQuerySchema = z.object({
  approvalStatus: proofClaimApprovalStatusSchema.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListProofClaimsQueryDto = z.infer<typeof listProofClaimsQuerySchema>;

export const createProofClaimSchema = z.object({
  publicId: z.string().min(1).max(64),
  claim: z.string().min(1).max(LONG_TEXT_MAX_LENGTH),
  claimType: shortTextField,
  beforeValue: shortTextField,
  afterValue: shortTextField,
  verificationStatus: proofClaimVerificationStatusSchema.optional(),
  approvedWording: longTextField,
  restrictions: longTextField,
  expiryReviewDate: z.string().date().nullish(),
  relatedServiceIds: idListField,
  relatedCaseStudyIds: unvalidatedIdListField,
  relatedPageIds: unvalidatedIdListField,
});
export type CreateProofClaimDto = z.infer<typeof createProofClaimSchema>;

// publicId is create-only, per the base-entity standard's own "never regenerated once assigned"
// rule — mirrors updatePersonaSchema's/updateServiceSchema's own contract. approvalStatus is
// deliberately not accepted here — it only changes via the dedicated status-transition route.
export const updateProofClaimSchema = z
  .object({
    claim: z.string().min(1).max(LONG_TEXT_MAX_LENGTH).optional(),
    claimType: shortTextField,
    beforeValue: shortTextField,
    afterValue: shortTextField,
    verificationStatus: proofClaimVerificationStatusSchema.optional(),
    approvedWording: longTextField,
    restrictions: longTextField,
    expiryReviewDate: z.string().date().nullish(),
    relatedServiceIds: idListField,
    relatedCaseStudyIds: unvalidatedIdListField,
    relatedPageIds: unvalidatedIdListField,
  })
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op that still writes an essentially-empty audit event, mirroring Persona Library's own
  // updatePersonaSchema fix.
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateProofClaimDto = z.infer<typeof updateProofClaimSchema>;

export const changeProofClaimApprovalStatusSchema = z.object({
  approvalStatus: proofClaimApprovalStatusSchema,
});
export type ChangeProofClaimApprovalStatusDto = z.infer<
  typeof changeProofClaimApprovalStatusSchema
>;

// --- claim_sources (child sub-resource) ---

export const createClaimSourceSchema = z.object({
  source: z.string().min(1).max(LONG_TEXT_MAX_LENGTH),
  sourceUrl: z.string().max(2048).nullish(),
});
export type CreateClaimSourceDto = z.infer<typeof createClaimSourceSchema>;

export const updateClaimSourceSchema = z
  .object({
    source: z.string().min(1).max(LONG_TEXT_MAX_LENGTH).optional(),
    sourceUrl: z.string().max(2048).nullish(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateClaimSourceDto = z.infer<typeof updateClaimSourceSchema>;
