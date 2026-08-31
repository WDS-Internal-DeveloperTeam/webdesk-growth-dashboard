import { z } from "zod";
import { safeHttpUrlSchema } from "@webdesk/validation";

// Mirrors packages/database/src/section-and-pattern-library/entities.ts's SectionPatternType — the
// spec's own §15 pattern-type taxonomy, 20 values, snake_case.
const PATTERN_TYPE_VALUES = [
  "homepage_storytelling",
  "service",
  "industry",
  "location",
  "landing_conversion",
  "portfolio_showcase",
  "social_proof",
  "results_metrics",
  "engagement_models",
  "team_expertise",
  "content_hub",
  "article",
  "lead_capture",
  "download",
  "multi_step_form",
  "search_filter",
  "trust",
  "objection_handling",
  "cross_sell",
  "error_no_results",
] as const;

export const sectionPatternTypeSchema = z.enum(PATTERN_TYPE_VALUES);

// Mirrors packages/database/src/section-and-pattern-library/entities.ts's
// SectionPatternApprovalStatus — identical vocabulary to Design Token Library's/Website Strategy
// Center's/Service Library's/Persona Library's/Proof and Claims Library's own, reused verbatim
// (design decision 2).
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

export const sectionPatternApprovalStatusSchema = z.enum(APPROVAL_STATUS_VALUES);

// `description`/`responsiveBehavior`/`accessibilityNotes` are rich-text-sanitized at write time
// (design decision — scope doc) even though no `dashboard-web` RichTextEditor UI exists yet for
// this module (backend-only pass, matching every prior module's own backend-first precedent) — a
// plain-text length cap here, not the doubled rich-text-markup-overhead cap
// (`LONG_TEXT_MAX_LENGTH = 40_000`) sibling modules raise to only once their own UI actually wires
// RichTextEditor in.
const RICH_TEXT_MAX_LENGTH = 20_000;
const richTextField = z.string().max(RICH_TEXT_MAX_LENGTH).nullish();

// `htmlStructure`/`scssReference`/`browserSupport` are plain code/notes fields — no sanitization
// applied (a code snippet, not prose, per the scope doc).
const PLAIN_TEXT_MAX_LENGTH = 20_000;
const plainTextField = z.string().max(PLAIN_TEXT_MAX_LENGTH).nullish();

const MAX_ARRAY_ITEMS = 50;
// .nullish(), not just .optional() — distinguishes "omitted" (no change) from "explicit null"
// (clear), mirroring designTokenLibrary.dto.ts's own usageReferencesField / persona-library.dto.ts's
// stringListField/idListField.
const stringArrayField = z.array(z.string().min(1).max(255)).max(MAX_ARRAY_ITEMS).nullish();

export const listSectionPatternRecordsQuerySchema = z.object({
  patternType: sectionPatternTypeSchema.optional(),
  approvalStatus: sectionPatternApprovalStatusSchema.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListSectionPatternRecordsQueryDto = z.infer<
  typeof listSectionPatternRecordsQuerySchema
>;

export const createSectionPatternRecordSchema = z.object({
  publicId: z.string().min(1).max(64),
  patternType: sectionPatternTypeSchema,
  name: z.string().min(1).max(255),
  description: richTextField,
  designReference: safeHttpUrlSchema.nullish(),
  htmlStructure: plainTextField,
  phpPath: z.string().max(500).nullish(),
  scssReference: plainTextField,
  jsDependencies: stringArrayField,
  responsiveBehavior: richTextField,
  accessibilityNotes: richTextField,
  browserSupport: plainTextField,
  tokenReferences: stringArrayField,
  relatedComponentIds: stringArrayField,
});
export type CreateSectionPatternRecordDto = z.infer<typeof createSectionPatternRecordSchema>;

// patternType/publicId are never accepted here — both immutable after creation. approvalStatus is
// likewise never accepted — only the dedicated status-transition route may change it, same
// discipline as every sibling module's own update schema.
export const updateSectionPatternRecordSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: richTextField,
    designReference: safeHttpUrlSchema.nullish(),
    htmlStructure: plainTextField,
    phpPath: z.string().max(500).nullish(),
    scssReference: plainTextField,
    jsDependencies: stringArrayField,
    responsiveBehavior: richTextField,
    accessibilityNotes: richTextField,
    browserSupport: plainTextField,
    tokenReferences: stringArrayField,
    relatedComponentIds: stringArrayField,
  })
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op that still writes an essentially-empty audit event, mirroring every sibling module's
  // own identical fix (Design Token Library's updateDesignTokenSchema, Website Strategy Center's
  // updateWebsiteStrategyRecordSchema, Persona Library's updatePersonaSchema).
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateSectionPatternRecordDto = z.infer<typeof updateSectionPatternRecordSchema>;

export const changeSectionPatternApprovalStatusSchema = z.object({
  approvalStatus: sectionPatternApprovalStatusSchema,
});
export type ChangeSectionPatternApprovalStatusDto = z.infer<
  typeof changeSectionPatternApprovalStatusSchema
>;
