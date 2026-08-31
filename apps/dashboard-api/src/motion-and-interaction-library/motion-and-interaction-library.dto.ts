import { z } from "zod";
import { safeHttpUrlSchema } from "@webdesk/validation";

// Mirrors packages/database/src/motion-and-interaction-library/entities.ts's
// MotionInteractionCategory — the spec's own §18 category taxonomy, 26 values, snake_case.
const MOTION_INTERACTION_CATEGORY_VALUES = [
  "page_transition",
  "focus_state",
  "active_state",
  "selected_state",
  "disabled_state",
  "form_feedback",
  "menu",
  "modal_drawer",
  "tooltip",
  "sticky_behavior",
  "content_reveal",
  "loader",
  "progress_indicator",
  "success_error_state",
  "notification",
  "media_control",
  "filter_search",
  "pagination",
  "copy_share",
  "anchor_scroll",
  "parallax",
  "cursor",
  "dismissal",
  "screen_reader_announcement",
  "timing_and_interruption",
  "analytics_event",
  "no_js_fallback",
] as const;

export const motionInteractionCategorySchema = z.enum(MOTION_INTERACTION_CATEGORY_VALUES);

// Mirrors packages/database/src/motion-and-interaction-library/entities.ts's
// MotionInteractionApprovalStatus — identical vocabulary to Section and Pattern Library's/Page
// Template Library's/Design Token Library's own, reused verbatim.
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

export const motionInteractionApprovalStatusSchema = z.enum(APPROVAL_STATUS_VALUES);

// `description`/`triggerAndBehavior`/`accessibilityNotes` are rich-text-sanitized at write time
// (design decision — scope doc). Raised 20,000 -> 40,000 now that the `dashboard-web`
// `RichTextEditor` UI actually wires these three fields in — the same markup-overhead-driven raise
// ratio every sibling module applies once its own UI lands (Section and Pattern Library, Page
// Template Library, Persona Library, Service Library, Website Strategy Center, Proof and Claims
// Library all converge on the identical 40,000 ceiling regardless of their own starting cap).
const RICH_TEXT_MAX_LENGTH = 40_000;
const richTextField = z.string().max(RICH_TEXT_MAX_LENGTH).nullish();

// `timingAndEasing`/`implementationSpec`/`fallbackBehavior` are plain code/spec-value fields — no
// sanitization applied, matching Section and Pattern Library's own `scssReference`/
// `htmlStructure` precedent.
const PLAIN_TEXT_MAX_LENGTH = 20_000;
const plainTextField = z.string().max(PLAIN_TEXT_MAX_LENGTH).nullish();

const MAX_RELATIONSHIP_IDS = 100;
// .nullish(), not just .optional() — distinguishes "omitted" (no change) from "explicit null"
// (clear), mirroring section-and-pattern-library.dto.ts's own stringArrayField /
// page-template-library.dto.ts's own idListField. Real, existence-validated relationship into
// Component Library (design decision) — unlike Section and Pattern Library's own
// relatedComponentIds (added before Component Library existed), Component Library already exists
// for this module, so real `.uuid()` ids are required here, matching Page Template Library's own
// supportedComponentIds precedent.
const relatedComponentIdsField = z.array(z.string().uuid()).max(MAX_RELATIONSHIP_IDS).nullish();

export const listMotionInteractionRecordsQuerySchema = z.object({
  category: motionInteractionCategorySchema.optional(),
  approvalStatus: motionInteractionApprovalStatusSchema.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListMotionInteractionRecordsQueryDto = z.infer<
  typeof listMotionInteractionRecordsQuerySchema
>;

export const createMotionInteractionRecordSchema = z.object({
  publicId: z.string().min(1).max(64),
  category: motionInteractionCategorySchema,
  name: z.string().min(1).max(255),
  description: richTextField,
  triggerAndBehavior: richTextField,
  timingAndEasing: plainTextField,
  implementationSpec: plainTextField,
  accessibilityNotes: richTextField,
  fallbackBehavior: plainTextField,
  designReference: safeHttpUrlSchema.nullish(),
  relatedComponentIds: relatedComponentIdsField,
});
export type CreateMotionInteractionRecordDto = z.infer<typeof createMotionInteractionRecordSchema>;

// category/publicId are never accepted here — both immutable after creation. approvalStatus is
// likewise never accepted — only the dedicated status-transition route may change it, same
// discipline as every sibling module's own update schema.
export const updateMotionInteractionRecordSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: richTextField,
    triggerAndBehavior: richTextField,
    timingAndEasing: plainTextField,
    implementationSpec: plainTextField,
    accessibilityNotes: richTextField,
    fallbackBehavior: plainTextField,
    designReference: safeHttpUrlSchema.nullish(),
    relatedComponentIds: relatedComponentIdsField,
  })
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op that still writes an essentially-empty audit event, mirroring every sibling module's
  // own identical fix (updateSectionPatternRecordSchema, updatePageTemplateSchema, etc.).
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateMotionInteractionRecordDto = z.infer<typeof updateMotionInteractionRecordSchema>;

export const changeMotionInteractionApprovalStatusSchema = z.object({
  approvalStatus: motionInteractionApprovalStatusSchema,
});
export type ChangeMotionInteractionApprovalStatusDto = z.infer<
  typeof changeMotionInteractionApprovalStatusSchema
>;
