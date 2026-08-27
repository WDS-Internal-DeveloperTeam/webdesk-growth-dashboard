import { z } from "zod";
import { safeHttpUrlSchema } from "@webdesk/validation";

// Mirrors packages/database/src/design-reference-library/entities.ts's
// DesignReferenceApprovalStatus — reused verbatim (D7) from Brand Library's/Content Template
// Library's/Persona Library's/Service Library's own identical ArtifactApprovalStatus union.
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

export const designReferenceApprovalStatusSchema = z.enum(APPROVAL_STATUS_VALUES);

// `.nullish()` so an explicit `null` can clear a field on update, same convention every sibling
// module's own text fields use.
const RICH_TEXT_MAX_LENGTH = 4000;
const richTextField = z.string().max(RICH_TEXT_MAX_LENGTH).nullish();

// Plain text (not rich text) fields — D5/D4. Shorter cap, matching a single-line/short-paragraph
// field, not a rich-text-sized one.
const PLAIN_TEXT_MAX_LENGTH = 2000;
const plainTextField = z.string().max(PLAIN_TEXT_MAX_LENGTH).nullish();

const PAGE_SECTION_TYPE_MAX_LENGTH = 255;

// `z.coerce.boolean()` runs `Boolean(value)` — since query params always arrive as strings,
// `?isPublished=false` would coerce to `Boolean("false")`, which is `true` (any non-empty string
// is truthy), silently inverting the filter. An explicit "true"/"false" literal map has no such
// trap — mirrors `listBrandLibraryRecordsQuerySchema`'s own already-fixed `booleanQueryParam`.
const booleanQueryParam = z.enum(["true", "false"]).transform((value) => value === "true");

export const listDesignReferenceRecordsQuerySchema = z.object({
  approvalStatus: designReferenceApprovalStatusSchema.optional(),
  isPublished: booleanQueryParam.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListDesignReferenceRecordsQueryDto = z.infer<
  typeof listDesignReferenceRecordsQuerySchema
>;

export const createDesignReferenceRecordSchema = z.object({
  publicId: z.string().min(1).max(64),
  title: z.string().min(1).max(255),
  // safeHttpUrlSchema (@webdesk/validation), not a bare z.string() — a stored `javascript:` value
  // would otherwise be a real stored-XSS path once this field is ever rendered as a link by a
  // future dashboard-web UI (D2), mirroring `BrandLibraryRecordEntity.fileReference`'s/
  // `ProjectEnvironment.url`'s own identical guard.
  sourceUrl: safeHttpUrlSchema.nullish(),
  screenshotUrl: safeHttpUrlSchema.nullish(),
  pageSectionType: z.string().max(PAGE_SECTION_TYPE_MAX_LENGTH).nullish(),
  likes: richTextField,
  dislikes: richTextField,
  desktopBehavior: plainTextField,
  mobileBehavior: plainTextField,
  motionNotes: richTextField,
  accessibilityConcerns: richTextField,
  performanceConcerns: richTextField,
  // Plain unvalidated tag list (D6) — no backing tag entity exists.
  tags: z.array(z.string().max(100)).max(50).optional(),
});
export type CreateDesignReferenceRecordDto = z.infer<typeof createDesignReferenceRecordSchema>;

// publicId is create-only (immutable after create, matching every sibling module's own
// public-identifier precedent). approvalStatus, version, isPublished, and publishedAt are
// deliberately not accepted here (D7/D8/D9) — approvalStatus only changes via the dedicated
// status-transition route, isPublished/publishedAt only change via the dedicated
// publish/unpublish routes, and version is server-managed, incremented automatically on every
// successful update. Derived from createDesignReferenceRecordSchema (mirrors
// updateBrandLibraryRecordSchema's own precedent) rather than hand-retyped, so `title`'s own
// constraints stay in exactly one place too.
export const updateDesignReferenceRecordSchema = createDesignReferenceRecordSchema
  .omit({ publicId: true })
  .partial()
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op that still burns a `version` increment (matches updateBrandLibraryRecordSchema's own
  // precedent).
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateDesignReferenceRecordDto = z.infer<typeof updateDesignReferenceRecordSchema>;

export const changeDesignReferenceApprovalStatusSchema = z.object({
  approvalStatus: designReferenceApprovalStatusSchema,
});
export type ChangeDesignReferenceApprovalStatusDto = z.infer<
  typeof changeDesignReferenceApprovalStatusSchema
>;
