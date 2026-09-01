import { z } from "zod";
import { safeHttpUrlSchema } from "@webdesk/validation";

// Mirrors packages/database/src/portfolio-library/entities.ts's PortfolioApprovalStatus — reused
// verbatim (D6) from Persona/Service/Proof and Claims/Website Strategy Center's/Content Template/
// Brand Library's own identical ArtifactApprovalStatus union.
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
export const portfolioApprovalStatusSchema = z.enum(APPROVAL_STATUS_VALUES);

// Mirrors Case Study Studio's own 4-value vocabulary (D4).
const VISIBILITY_VALUES = [
  "public",
  "internal_only",
  "confidential",
  "client_approval_required",
] as const;
export const portfolioVisibilitySchema = z.enum(VISIBILITY_VALUES);

const shortTextField = z.string().max(255).nullish();

// additionalCategories/tags are plain free-text string arrays, no categories taxonomy module
// exists (D8) — `.nullish()` so an explicit `null` can clear the field on update, matching every
// sibling array field's own null-to-clear convention (the columns themselves are NOT NULL,
// normalized to `[]` by the repository layer, mirroring CaseStudyRepository's own normalization).
const idOrLabelListField = z.array(z.string().min(1).max(255)).max(200).nullish();

// relatedProofIds points at real proof_claims rows (D3) — typed as a UUID array at the DTO layer
// so a malformed id is rejected with a clean 400 before it ever reaches the service, rather than
// relying solely on PortfolioRecordsService's own UUID_PATTERN filter as the sole guard.
const idListField = z.array(z.string().uuid()).max(200).nullish();

// `z.coerce.boolean()` runs `Boolean(value)` — since query params always arrive as strings,
// `?isPublished=false` would coerce to `Boolean("false")`, which is `true` (any non-empty string
// is truthy), silently inverting the filter. An explicit "true"/"false" literal map has no such
// trap — mirrors `operational-contacts.dto.ts`'s/`content-template-library.dto.ts`'s own
// `booleanQueryParam` for the identical, already-fixed bug class.
const booleanQueryParam = z.enum(["true", "false"]).transform((value) => value === "true");

/** Rejects a genuinely empty patch object (`{}`) with a clean 400 instead of silently succeeding
 *  as a no-op — shared by both update schemas below so the message text can't drift between them. */
function rejectEmptyPatch<T extends z.ZodTypeAny>(schema: T) {
  return schema.refine((data: object) => Object.keys(data as Record<string, unknown>).length > 0, {
    message: "At least one field must be provided",
  });
}

export const listPortfolioRecordsQuerySchema = z.object({
  approvalStatus: portfolioApprovalStatusSchema.optional(),
  isPublished: booleanQueryParam.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListPortfolioRecordsQueryDto = z.infer<typeof listPortfolioRecordsQuerySchema>;

export const createPortfolioRecordSchema = z.object({
  publicId: z.string().min(1).max(64),
  projectOrClientName: z.string().min(1).max(255),
  url: safeHttpUrlSchema.nullish(),
  primaryCategory: shortTextField,
  additionalCategories: idOrLabelListField,
  tags: idOrLabelListField,
  industry: shortTextField,
  platform: shortTextField,
  serviceType: shortTextField,
  launchDate: z.string().date().nullish(),
  // Existence-validated at the service layer (PortfolioRecordsService.assertProofIdsExist()),
  // mirroring Persona Library's/Case Study Studio's own idListField shape.
  relatedProofIds: idListField,
  visibility: portfolioVisibilitySchema.optional(),
});
export type CreatePortfolioRecordDto = z.infer<typeof createPortfolioRecordSchema>;

// publicId is create-only, per the base-entity standard's own "never regenerated once assigned"
// rule — omitted, not re-declared. approvalStatus, isPublished, publishedAt, and version are
// deliberately not accepted here (D5/D6/D7) — approvalStatus only changes via the dedicated
// status-transition route, isPublished/publishedAt only change via the dedicated publish/unpublish
// routes, and version is server-managed, incremented automatically on every successful update.
// Derived from createPortfolioRecordSchema (mirroring content-template-library.dto.ts's own
// already-established derivation pattern) rather than hand-retyped, so the 10 content fields'
// constraints stay in exactly one place.
// Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
// no-op that still burns a `version` increment (matches updatePersonaSchema's/
// updateContentTemplateSchema's own precedent).
export const updatePortfolioRecordSchema = rejectEmptyPatch(
  createPortfolioRecordSchema.omit({ publicId: true }).partial(),
);
export type UpdatePortfolioRecordDto = z.infer<typeof updatePortfolioRecordSchema>;

export const changePortfolioApprovalStatusSchema = z.object({
  approvalStatus: portfolioApprovalStatusSchema,
});
export type ChangePortfolioApprovalStatusDto = z.infer<typeof changePortfolioApprovalStatusSchema>;

// --- portfolio_assets (screenshots child sub-resource, D2) ---

export const createPortfolioAssetSchema = z.object({
  assetId: z.string().uuid(),
  role: z.string().min(1).max(64),
  caption: shortTextField,
});
export type CreatePortfolioAssetDto = z.infer<typeof createPortfolioAssetSchema>;

// Derived via .omit().partial() from createPortfolioAssetSchema, mirroring
// updateCaseStudyAssetSchema's own precedent. `assetId` is create-only — this join row's identity
// is the (portfolio record, asset) pair; re-pointing it at a different asset is a delete+create,
// not an edit.
export const updatePortfolioAssetSchema = rejectEmptyPatch(
  createPortfolioAssetSchema.omit({ assetId: true }).partial(),
);
export type UpdatePortfolioAssetDto = z.infer<typeof updatePortfolioAssetSchema>;
