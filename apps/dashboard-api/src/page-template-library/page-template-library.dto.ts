import { z } from "zod";

// Mirrors packages/database/src/page-template-library/entities.ts's PageTemplateApprovalStatus —
// identical vocabulary to Design Token Library's/Component Library's/Section and Pattern
// Library's own, reused verbatim (design decision D1).
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

export const pageTemplateApprovalStatusSchema = z.enum(APPROVAL_STATUS_VALUES);

// The spec's own closed §16 taxonomy, 17 values (design decision D5).
const PAGE_TYPE_VALUES = [
  "homepage",
  "service",
  "platform",
  "industry",
  "location",
  "case_study",
  "portfolio",
  "landing",
  "article",
  "about",
  "contact",
  "team",
  "careers",
  "archive_category",
  "confirmation",
  "not_found",
  "campaign_event",
] as const;

export const pageTypeSchema = z.enum(PAGE_TYPE_VALUES);

const MAX_RELATIONSHIP_IDS = 100;
// .nullish(), not just .optional() — every other nullable field in this file distinguishes
// "omitted" (no change) from "explicit null" (clear), mirroring
// component-library.dto.ts's own tokenIdsField.
const idListField = z.array(z.string().uuid()).max(MAX_RELATIONSHIP_IDS).nullish();

// wireframeReferences is a plain, UNVALIDATED string array (design decision D4) — NOT
// uuid-validated, since wireframe_library doesn't exist yet and these are unvalidated free
// references, unlike requiredSectionIds/optionalSectionIds/supportedComponentIds above.
const wireframeReferencesField = z
  .array(z.string().min(1).max(500))
  .max(MAX_RELATIONSHIP_IDS)
  .nullish();

// One shared shape for every optional long-text field below — narrative/prose fields (design
// decision, other-fields notes), matching component-library.dto.ts's own textField helper.
const textField = (max: number) => z.string().max(max).nullish();

export const listPageTemplatesQuerySchema = z.object({
  pageType: pageTypeSchema.optional(),
  approvalStatus: pageTemplateApprovalStatusSchema.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListPageTemplatesQueryDto = z.infer<typeof listPageTemplatesQuerySchema>;

// A section can be required or optional for a template, never both at once — an id present in
// both arrays would be ambiguous for any future UI rendering "required" vs. "optional" sections.
// Only checked when both fields are actually present in the same request (create always supplies
// both as real arrays or omits them; update's partial patch may supply only one, in which case
// there is nothing in this request to compare against the other side's current, unpatched value).
function hasOverlappingSectionIds(data: {
  requiredSectionIds?: readonly string[] | null;
  optionalSectionIds?: readonly string[] | null;
}): boolean {
  if (!data.requiredSectionIds || !data.optionalSectionIds) {
    return false;
  }
  const required = new Set(data.requiredSectionIds);
  return data.optionalSectionIds.some((id) => required.has(id));
}
const OVERLAPPING_SECTION_IDS_ISSUE = {
  message: "A section cannot be both required and optional at the same time",
  path: ["optionalSectionIds"] as string[],
};

export const createPageTemplateSchema = z
  .object({
    publicId: z.string().min(1).max(64),
    pageType: pageTypeSchema,
    name: z.string().min(1).max(255),
    requiredSectionIds: idListField,
    optionalSectionIds: idListField,
    supportedComponentIds: idListField,
    wireframeReferences: wireframeReferencesField,
    contentRequirements: textField(4_000),
    searchRequirements: textField(4_000),
    conversionGoal: textField(4_000),
    phpTemplateRelationship: textField(2_000),
    // Existence-checked in-module (PageTemplatesService.assertReplacementExists()) against this
    // same table's own recordId — never immutable across a version chain, unlike pageType
    // (design decision, other-fields notes).
    replacementRecordId: z.string().uuid().nullish(),
  })
  .refine((data) => !hasOverlappingSectionIds(data), OVERLAPPING_SECTION_IDS_ISSUE);
export type CreatePageTemplateDto = z.infer<typeof createPageTemplateSchema>;

// pageType/publicId are never accepted here — both immutable after creation. approvalStatus is
// likewise never accepted — only the dedicated status-transition route may change it, same
// discipline as every sibling module's own update schema.
export const updatePageTemplateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    requiredSectionIds: idListField,
    optionalSectionIds: idListField,
    supportedComponentIds: idListField,
    wireframeReferences: wireframeReferencesField,
    contentRequirements: textField(4_000),
    searchRequirements: textField(4_000),
    conversionGoal: textField(4_000),
    phpTemplateRelationship: textField(2_000),
    replacementRecordId: z.string().uuid().nullish(),
  })
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op that still writes an essentially-empty audit event, mirroring every sibling module's
  // own identical fix (updateComponentSchema, updateDesignTokenSchema, etc.).
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  })
  .refine((data) => !hasOverlappingSectionIds(data), OVERLAPPING_SECTION_IDS_ISSUE);
export type UpdatePageTemplateDto = z.infer<typeof updatePageTemplateSchema>;

export const changePageTemplateApprovalStatusSchema = z.object({
  approvalStatus: pageTemplateApprovalStatusSchema,
});
export type ChangePageTemplateApprovalStatusDto = z.infer<
  typeof changePageTemplateApprovalStatusSchema
>;
