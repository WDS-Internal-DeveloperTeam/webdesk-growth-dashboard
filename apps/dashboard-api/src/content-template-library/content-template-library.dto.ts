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

// `z.coerce.boolean()` runs `Boolean(value)` — since query params always arrive as strings,
// `?isPublished=false` would coerce to `Boolean("false")`, which is `true` (any non-empty string
// is truthy), silently inverting the filter (code-review finding, matching
// `operational-contacts.dto.ts`'s own already-fixed `booleanQueryParam` for the identical bug
// class). An explicit "true"/"false" literal map has no such trap.
const booleanQueryParam = z.enum(["true", "false"]).transform((value) => value === "true");

export const listContentTemplatesQuerySchema = z.object({
  approvalStatus: contentTemplateApprovalStatusSchema.optional(),
  isPublished: booleanQueryParam.optional(),
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
// rule — omitted, not re-declared. approvalStatus, version, isPublished, and publishedAt are
// deliberately not accepted here (D2/D4/D5) — approvalStatus only changes via the dedicated
// status-transition route, isPublished/publishedAt only change via the dedicated publish/unpublish
// routes, and version is server-managed, incremented automatically on every successful update.
// Derived from createContentTemplateSchema (code-review finding: the 8 content fields were
// previously hand-re-declared byte-for-byte here, risking silent drift if a field is ever added to
// one schema and not the other) rather than hand-retyped, so `pageType`'s own constraints stay in
// exactly one place too.
export const updateContentTemplateSchema = createContentTemplateSchema
  .omit({ publicId: true })
  .partial()
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
