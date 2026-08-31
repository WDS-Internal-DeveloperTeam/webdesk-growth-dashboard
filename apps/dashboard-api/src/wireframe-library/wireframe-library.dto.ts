import { z } from "zod";
import { safeHttpUrlSchema } from "@webdesk/validation";

// Mirrors packages/database/src/wireframe-library/entities.ts's WireframeViewport.
export const wireframeViewportSchema = z.enum(["mobile", "tablet", "desktop"]);

// Mirrors packages/database/src/wireframe-library/entities.ts's WireframeApprovalStatus —
// identical vocabulary to Section and Pattern Library's/Design Token Library's/Website Strategy
// Center's/Service Library's/Persona Library's/Proof and Claims Library's own, reused verbatim.
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

export const wireframeApprovalStatusSchema = z.enum(APPROVAL_STATUS_VALUES);

// `annotations`/`interactionNotes` are rich-text-sanitized at write time (scope doc). The
// `dashboard-web` RichTextEditor UI now wires both fields in (see
// `docs/implementation/module-wireframe-library.md`'s "dashboard-web UI" section) — raised from
// this module's own original backend-only-pass plain-text cap (20,000) to the doubled
// rich-text-markup-overhead cap every sibling module's own UI raises to once it wires
// RichTextEditor in (mirrors Section and Pattern Library's/Persona Library's/Service Library's own
// identical raise ratio).
const RICH_TEXT_MAX_LENGTH = 40_000;
const richTextField = z.string().max(RICH_TEXT_MAX_LENGTH).nullish();

const UUID_FIELD = z.string().uuid();

export const listWireframeRecordsQuerySchema = z.object({
  viewport: wireframeViewportSchema.optional(),
  approvalStatus: wireframeApprovalStatusSchema.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListWireframeRecordsQueryDto = z.infer<typeof listWireframeRecordsQuerySchema>;

export const createWireframeRecordSchema = z.object({
  publicId: z.string().min(1).max(64),
  pageOrModule: z.string().min(1).max(2000),
  viewport: wireframeViewportSchema,
  fileReference: safeHttpUrlSchema.nullish(),
  annotations: richTextField,
  interactionNotes: richTextField,
  // Plain, unvalidated string — no `page_template_library` module exists yet (real dependency
  // cycle, see migration 00084's own doc comment).
  relatedTemplateId: z.string().max(255).nullish(),
  reviewerUserId: UUID_FIELD.nullish(),
});
export type CreateWireframeRecordDto = z.infer<typeof createWireframeRecordSchema>;

// pageOrModule/publicId are never accepted here — both immutable after creation. approvalStatus
// is likewise never accepted — only the dedicated status-transition route may change it, same
// discipline as every sibling module's own update schema.
export const updateWireframeRecordSchema = z
  .object({
    viewport: wireframeViewportSchema.optional(),
    fileReference: safeHttpUrlSchema.nullish(),
    annotations: richTextField,
    interactionNotes: richTextField,
    relatedTemplateId: z.string().max(255).nullish(),
    reviewerUserId: UUID_FIELD.nullish(),
  })
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op that still writes an essentially-empty audit event, mirroring every sibling module's own
  // identical fix (Section and Pattern Library's updateSectionPatternRecordSchema, Design Token
  // Library's updateDesignTokenSchema, Persona Library's updatePersonaSchema).
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateWireframeRecordDto = z.infer<typeof updateWireframeRecordSchema>;

export const changeWireframeApprovalStatusSchema = z.object({
  approvalStatus: wireframeApprovalStatusSchema,
});
export type ChangeWireframeApprovalStatusDto = z.infer<typeof changeWireframeApprovalStatusSchema>;
