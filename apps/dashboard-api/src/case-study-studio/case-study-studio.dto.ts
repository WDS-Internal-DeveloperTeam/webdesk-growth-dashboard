import { z } from "zod";
import { safeHttpUrlSchema } from "@webdesk/validation";

// Mirrors packages/database/src/case-study-studio/entities.ts's CaseStudyStatus — D1's full
// bespoke 14-stage lifecycle.
const STATUS_VALUES = [
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
] as const;
export const caseStudyStatusSchema = z.enum(STATUS_VALUES);

const VISIBILITY_VALUES = [
  "public",
  "internal_only",
  "confidential",
  "client_approval_required",
] as const;
export const caseStudyVisibilitySchema = z.enum(VISIBILITY_VALUES);

const ASSET_ROLE_VALUES = [
  "hero_screenshot",
  "logo",
  "testimonial_screenshot",
  "video",
  "document",
  "other",
] as const;
export const caseStudyAssetRoleSchema = z.enum(ASSET_ROLE_VALUES);

const CONSENT_TYPE_VALUES = ["client_publication", "testimonial", "logo_usage", "other"] as const;
export const caseStudyConsentTypeSchema = z.enum(CONSENT_TYPE_VALUES);

// challenge/solution/implementation/results are real HTML from dashboard-web's RichTextEditor
// (Tiptap) — sanitized server-side before storage, per the 2026-08-22 standing rule requiring
// every long-text field to use the rich-text editor, wired ahead of the dashboard-web UI build
// (D10) — mirroring Persona Library's/Website Strategy Center's own backend-first rich-text
// wiring. 40,000 is the converged ceiling every sibling rich-text-ready field lands on regardless
// of its own starting cap (see docs/implementation/rich-text-editor-long-fields.md).
const RICH_TEXT_MAX_LENGTH = 40_000;
const richTextField = z.string().max(RICH_TEXT_MAX_LENGTH).nullish();

const shortTextField = z.string().max(255).nullish();

// One shared shape for related-id fields — relatedServiceIds/relatedClaimIds are both
// existence-validated at the service layer (CaseStudiesService.assertServiceIdsExist()/
// assertClaimIdsExist()), mirroring Persona Library's/Proof and Claims Library's own idListField.
// `.nullish()` so an explicit `null` can clear the field on update.
const idListField = z.array(z.string().min(1).max(128)).max(200).nullish();

export const listCaseStudiesQuerySchema = z.object({
  status: caseStudyStatusSchema.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListCaseStudiesQueryDto = z.infer<typeof listCaseStudiesQuerySchema>;

export const createCaseStudySchema = z.object({
  publicId: z.string().min(1).max(64),
  clientName: z.string().min(1).max(255),
  projectTitle: z.string().min(1).max(255),
  industry: shortTextField,
  platform: shortTextField,
  visibility: caseStudyVisibilitySchema.optional(),
  embargoDate: z.string().date().nullish(),
  challenge: richTextField,
  solution: richTextField,
  implementation: richTextField,
  results: richTextField,
  relatedServiceIds: idListField,
  relatedClaimIds: idListField,
  assignedReviewerUserId: z.string().uuid().nullish(),
  clientApprovalRequired: z.boolean().optional(),
  scheduledPublishAt: z.string().datetime().nullish(),
});
export type CreateCaseStudyDto = z.infer<typeof createCaseStudySchema>;

// Derived via .omit().partial() from createCaseStudySchema (code-review finding — the three
// update schemas in this file were originally hand-duplicated field-by-field, a known-repeated
// drift risk in this codebase; content-template-library.dto.ts already established this
// derivation pattern). `publicId` is create-only, per the base-entity standard's own "never
// regenerated once assigned" rule. `status`/`publishedAt` are deliberately not accepted here —
// they only change via the dedicated status-transition route. `clientApprovalRequired` is ALSO
// excluded here (code-review finding) — it is a one-time intake decision about whether this case
// study needs client sign-off; accepting it through the ordinary content-edit route let a caller
// holding only `edit`+`approve` flip it mid-workflow (e.g. to `false` right before
// `internal_approval->scheduled`) and silently skip the `client_approval` stage the record was
// originally flagged as requiring. It is now immutable once set at intake.
export const updateCaseStudySchema = createCaseStudySchema
  .omit({ publicId: true, clientApprovalRequired: true })
  .partial()
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op that still burns a version number and writes an essentially-empty audit event,
  // mirroring Persona Library's own updatePersonaSchema fix.
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateCaseStudyDto = z.infer<typeof updateCaseStudySchema>;

// Only the requested target `status` is client-supplied — mirrors
// `changeServiceApprovalStatusSchema`'s/`changeProofClaimApprovalStatusSchema`'s own shape
// exactly (the service layer reads the record's real current status fresh at call time and uses
// it as the CAS `expectedStatus`, rather than trusting a client-supplied "what I last saw"
// value — unlike Review and Approval Center's genuinely different `decide()` shape, which this
// module does not need). `notes` on an `internal_approval`/`client_approval`-stage transition is
// sanitized rich text (server-layer) and recorded on the resulting `case_study_approvals` row
// (D7). `unpublishReason` is required by the service layer specifically on the
// `published -> unpublished` transition (D5), not enforced here at the schema level, since it's
// the ONLY transition that requires it.
export const changeCaseStudyStatusSchema = z.object({
  status: caseStudyStatusSchema,
  notes: richTextField,
  unpublishReason: z.string().min(1).max(RICH_TEXT_MAX_LENGTH).nullish(),
});
export type ChangeCaseStudyStatusDto = z.infer<typeof changeCaseStudyStatusSchema>;

// --- case_study_assets (child sub-resource, D3) ---

export const createCaseStudyAssetSchema = z.object({
  assetId: z.string().uuid(),
  role: caseStudyAssetRoleSchema,
  caption: shortTextField,
});
export type CreateCaseStudyAssetDto = z.infer<typeof createCaseStudyAssetSchema>;

// Derived via .omit().partial() from createCaseStudyAssetSchema (code-review finding — was
// hand-duplicated). `assetId` is create-only — this join row's identity is the (case study,
// asset) pair; re-pointing it at a different asset is a delete+create, not an edit.
export const updateCaseStudyAssetSchema = createCaseStudyAssetSchema
  .omit({ assetId: true })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateCaseStudyAssetDto = z.infer<typeof updateCaseStudyAssetSchema>;

// --- case_study_consents (child sub-resource) ---

// safeHttpUrlSchema (@webdesk/validation), not a bare z.string() — a stored `javascript:` value
// here would be a real stored-XSS vector once any future dashboard-web UI renders the evidence
// reference as a clickable link, the exact class of finding Projects' own environment.url shipped
// once and had to fix after the fact, and Proof and Claims Library's own sourceUrl field was
// built to avoid on its first pass.
export const createCaseStudyConsentSchema = z.object({
  consentType: caseStudyConsentTypeSchema,
  consentEvidenceReference: safeHttpUrlSchema.nullish(),
  grantedBy: shortTextField,
  grantedAt: z.string().datetime().nullish(),
  notes: shortTextField,
});
export type CreateCaseStudyConsentDto = z.infer<typeof createCaseStudyConsentSchema>;

// Derived via .omit().partial() from createCaseStudyConsentSchema (code-review finding — was
// hand-duplicated).
export const updateCaseStudyConsentSchema = createCaseStudyConsentSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateCaseStudyConsentDto = z.infer<typeof updateCaseStudyConsentSchema>;
