import { z } from "zod";

// Mirrors packages/database/src/content-template-library/entities.ts's
// ContentTemplateApprovalStatus — reused verbatim (D4) from Persona Library's/Service Library's
// own identical ArtifactApprovalStatus union.
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

export const contentTemplateApprovalStatusSchema = z.enum(APPROVAL_STATUS_VALUES);

// Backend-only pass (task package §5) — no dashboard-web UI, no RichTextEditor wiring yet, so
// these stay plain TEXT columns capped at .max(2000) (D8), matching Internal Linking Library's own
// `context` field precedent before its dashboard-web UI existed. `.nullish()` so an explicit
// `null` can clear a field on update, same convention every sibling module's own text fields use.
const LONG_TEXT_MAX_LENGTH = 2000;
const longTextField = z.string().max(LONG_TEXT_MAX_LENGTH).nullish();

// Guidance labels, not identifier lists — no existence validation (D7). `.nullish()` so an
// explicit `null` can clear the field on update, matching the scalar text fields' own
// null-to-clear convention; genuinely nullable at the database layer too (unlike Persona
// Library's own NOT-NULL-default-`[]` array columns), so `null` is stored as `null` directly, not
// normalized to `[]`.
const sectionListField = z.array(z.string().min(1).max(255)).max(100).nullish();

export const listContentTemplatesQuerySchema = z.object({
  approvalStatus: contentTemplateApprovalStatusSchema.optional(),
  isPublished: z.coerce.boolean().optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListContentTemplatesQueryDto = z.infer<typeof listContentTemplatesQuerySchema>;

export const createContentTemplateSchema = z.object({
  publicId: z.string().min(1).max(64),
  pageType: z.string().min(1).max(255),
  purpose: longTextField,
  requiredSections: sectionListField,
  optionalSections: sectionListField,
  proofRules: longTextField,
  seoAeoGeoRequirements: longTextField,
  schema: longTextField,
  ctaRules: longTextField,
  contentDepthGuidance: longTextField,
});
export type CreateContentTemplateDto = z.infer<typeof createContentTemplateSchema>;

// publicId is create-only, per the base-entity standard's own "never regenerated once assigned"
// rule. approvalStatus, version, isPublished, and publishedAt are deliberately not accepted here
// (D2/D4/D5) — approvalStatus only changes via the dedicated status-transition route,
// isPublished/publishedAt only change via the dedicated publish/unpublish routes, and version is
// server-managed, incremented automatically on every successful update.
export const updateContentTemplateSchema = z
  .object({
    pageType: z.string().min(1).max(255).optional(),
    purpose: longTextField,
    requiredSections: sectionListField,
    optionalSections: sectionListField,
    proofRules: longTextField,
    seoAeoGeoRequirements: longTextField,
    schema: longTextField,
    ctaRules: longTextField,
    contentDepthGuidance: longTextField,
  })
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op that still burns a `version` increment (matches updatePersonaSchema's own precedent).
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateContentTemplateDto = z.infer<typeof updateContentTemplateSchema>;

export const changeContentTemplateApprovalStatusSchema = z.object({
  approvalStatus: contentTemplateApprovalStatusSchema,
});
export type ChangeContentTemplateApprovalStatusDto = z.infer<
  typeof changeContentTemplateApprovalStatusSchema
>;
