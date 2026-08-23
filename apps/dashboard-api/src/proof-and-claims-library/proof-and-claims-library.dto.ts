import { z } from "zod";
import { safeHttpUrlSchema } from "@webdesk/validation";

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

// claim/approvedWording/restrictions are now real HTML from `dashboard-web`'s `RichTextEditor`
// (Tiptap) — raised from this module's original 20_000 plain-text cap alongside the
// dashboard-web-proof-and-claims-library UI build, per the 2026-08-22 standing rule requiring
// every long-text field to use the rich-text editor going forward. Sanitized server-side before
// storage (`ClaimsService`'s `sanitizeNullableRichText()`/`sanitizeNullableRichTextIfChanged()`),
// mirroring Persona Library's own identical rich-text-editor conversion pass exactly. `source`
// (`createClaimSourceSchema`/`updateClaimSourceSchema` below) shares this same constant but stays
// plain text, not rich text — the sub-resource fields on this module's own parent's sibling
// modules (Projects' Objectives/Repositories/Environments) stayed plain when their parent's own
// field converted, and `source` is a short citation/reference description, not authored narrative
// content, matching that precedent.
const LONG_TEXT_MAX_LENGTH = 40_000;
const longTextField = z.string().max(LONG_TEXT_MAX_LENGTH).nullish();

const shortTextField = z.string().max(255).nullish();

// One shared shape for every identifier-list field this module has — `relatedServiceIds` is
// additionally existence-validated against the real `services` table at the service layer (see
// ClaimsService.assertServiceIdsExist()), mirroring Persona Library's own idListField; `services`
// already exists, unlike relatedCaseStudyIds/relatedPageIds's own target modules
// (`case_study_studio`/`page_inventory`, which don't exist yet, mirroring Service Library's own
// icpIds/relatedPageIds/relatedCaseStudyIds precedent) — the Zod shape itself is identical either
// way, since the existence check happens in the service, not the schema (code-review finding: this
// was previously two byte-identical schemas under two names in this same file). `.nullish()` so an
// explicit `null` can clear the field on update.
const idListField = z.array(z.string().min(1).max(128)).max(200).nullish();

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
  relatedCaseStudyIds: idListField,
  relatedPageIds: idListField,
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
    relatedCaseStudyIds: idListField,
    relatedPageIds: idListField,
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

// safeHttpUrlSchema (@webdesk/validation), not a bare z.string() — a stored `javascript:` value
// here would be a real stored-XSS vector once any future dashboard-web UI renders a source as a
// clickable link, the exact class of finding Projects' own environment.url shipped once and had
// to fix after the fact (code-review finding: this field repeated that same gap on its first
// pass).
export const createClaimSourceSchema = z.object({
  source: z.string().min(1).max(LONG_TEXT_MAX_LENGTH),
  sourceUrl: safeHttpUrlSchema.nullish(),
});
export type CreateClaimSourceDto = z.infer<typeof createClaimSourceSchema>;

export const updateClaimSourceSchema = z
  .object({
    source: z.string().min(1).max(LONG_TEXT_MAX_LENGTH).optional(),
    sourceUrl: safeHttpUrlSchema.nullish(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateClaimSourceDto = z.infer<typeof updateClaimSourceSchema>;
