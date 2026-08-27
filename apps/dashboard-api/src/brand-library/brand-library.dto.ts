import { z } from "zod";
import { safeHttpUrlSchema } from "@webdesk/validation";

// Mirrors packages/database/src/brand-library/entities.ts's BrandLibraryRecordType (D1).
const RECORD_TYPE_VALUES = [
  "logo",
  "color",
  "typography",
  "photography",
  "illustration",
  "icon_rule",
  "tone",
  "visual_personality",
  "dos_dont",
] as const;

export const brandLibraryRecordTypeSchema = z.enum(RECORD_TYPE_VALUES);

// Mirrors packages/database/src/brand-library/entities.ts's BrandLibraryApprovalStatus — reused
// verbatim (D4) from Content Template Library's/Persona Library's/Service Library's own identical
// ArtifactApprovalStatus union.
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

export const brandLibraryApprovalStatusSchema = z.enum(APPROVAL_STATUS_VALUES);

// `.nullish()` so an explicit `null` can clear a field on update, same convention every sibling
// module's own text fields use.
const LONG_TEXT_MAX_LENGTH = 4000;
const longTextField = z.string().max(LONG_TEXT_MAX_LENGTH).nullish();

// `z.coerce.boolean()` runs `Boolean(value)` — since query params always arrive as strings,
// `?isPublished=false` would coerce to `Boolean("false")`, which is `true` (any non-empty string
// is truthy), silently inverting the filter. An explicit "true"/"false" literal map has no such
// trap — mirrors `listContentTemplatesQuerySchema`'s own already-fixed `booleanQueryParam`.
const booleanQueryParam = z.enum(["true", "false"]).transform((value) => value === "true");

export const listBrandLibraryRecordsQuerySchema = z.object({
  recordType: brandLibraryRecordTypeSchema.optional(),
  approvalStatus: brandLibraryApprovalStatusSchema.optional(),
  isPublished: booleanQueryParam.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListBrandLibraryRecordsQueryDto = z.infer<typeof listBrandLibraryRecordsQuerySchema>;

export const createBrandLibraryRecordSchema = z.object({
  publicId: z.string().min(1).max(64),
  recordType: brandLibraryRecordTypeSchema,
  title: z.string().min(1).max(255),
  description: longTextField,
  // safeHttpUrlSchema (@webdesk/validation), not a bare z.string() — a stored `javascript:` value
  // would otherwise be a real stored-XSS path once this field is ever rendered as a link by a
  // future dashboard-web UI (D2), mirroring `ProjectEnvironment.url`'s/
  // `ProofClaim.claimSources[].sourceUrl`'s own identical guard.
  fileReference: safeHttpUrlSchema.nullish(),
  usageNotes: longTextField,
});
export type CreateBrandLibraryRecordDto = z.infer<typeof createBrandLibraryRecordSchema>;

// publicId and recordType are both create-only (D1's own "immutable after create" rule — changing
// recordType after creation would be a different record). approvalStatus, version, isPublished,
// and publishedAt are deliberately not accepted here (D4/D5/D6) — approvalStatus only changes via
// the dedicated status-transition route, isPublished/publishedAt only change via the dedicated
// publish/unpublish routes, and version is server-managed, incremented automatically on every
// successful update. Derived from createBrandLibraryRecordSchema (mirrors
// updateContentTemplateSchema's own precedent) rather than hand-retyped, so `title`'s own
// constraints stay in exactly one place too.
export const updateBrandLibraryRecordSchema = createBrandLibraryRecordSchema
  .omit({ publicId: true, recordType: true })
  .partial()
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op that still burns a `version` increment (matches updateContentTemplateSchema's own
  // precedent).
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateBrandLibraryRecordDto = z.infer<typeof updateBrandLibraryRecordSchema>;

export const changeBrandLibraryApprovalStatusSchema = z.object({
  approvalStatus: brandLibraryApprovalStatusSchema,
});
export type ChangeBrandLibraryApprovalStatusDto = z.infer<
  typeof changeBrandLibraryApprovalStatusSchema
>;
