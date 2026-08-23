import { z } from "zod";

// Mirrors packages/database/src/website-strategy-center/entities.ts's WebsiteStrategyRecordType —
// task package D5, the spec's own 9 "Primary records," snake_case.
const RECORD_TYPE_VALUES = [
  "navigation_plan",
  "page_clusters",
  "pillar_strategy",
  "platform_strategy",
  "industry_strategy",
  "location_strategy",
  "conversion_plan",
  "search_plan",
  "internal_link_plan",
] as const;

export const websiteStrategyRecordTypeSchema = z.enum(RECORD_TYPE_VALUES);

// Mirrors packages/database/src/website-strategy-center/entities.ts's WebsiteStrategyApprovalStatus
// — identical vocabulary to Service Library's/Persona Library's/Proof and Claims Library's own,
// reused verbatim (task package D6).
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

export const websiteStrategyApprovalStatusSchema = z.enum(APPROVAL_STATUS_VALUES);

// Raised from 20,000 alongside the dashboard-web UI build (rich-text editor rollout) — content/
// notes are now real HTML from RichTextEditor, carrying real markup overhead over the equivalent
// plain text, the same doubled-cap ratio every sibling module's own rich-text conversion used.
const LONG_TEXT_MAX_LENGTH = 40_000;
const longTextField = z.string().max(LONG_TEXT_MAX_LENGTH).nullish();

export const listWebsiteStrategyRecordsQuerySchema = z.object({
  recordType: websiteStrategyRecordTypeSchema.optional(),
  approvalStatus: websiteStrategyApprovalStatusSchema.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListWebsiteStrategyRecordsQueryDto = z.infer<
  typeof listWebsiteStrategyRecordsQuerySchema
>;

export const createWebsiteStrategyRecordSchema = z.object({
  publicId: z.string().min(1).max(64),
  recordType: websiteStrategyRecordTypeSchema,
  title: z.string().min(1).max(255),
  content: longTextField,
  notes: longTextField,
});
export type CreateWebsiteStrategyRecordDto = z.infer<typeof createWebsiteStrategyRecordSchema>;

// recordType/publicId are never accepted here — both immutable after creation (task package D3).
// approvalStatus is likewise never accepted — only the dedicated status-transition route may
// change it, same discipline as every sibling module's own update schema.
export const updateWebsiteStrategyRecordSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),
    content: longTextField,
    notes: longTextField,
  })
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op that still writes an essentially-empty audit event, mirroring every sibling module's
  // own identical fix (Persona Library's updatePersonaSchema, Proof and Claims Library's
  // updateProofClaimSchema).
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateWebsiteStrategyRecordDto = z.infer<typeof updateWebsiteStrategyRecordSchema>;

export const changeWebsiteStrategyApprovalStatusSchema = z.object({
  approvalStatus: websiteStrategyApprovalStatusSchema,
});
export type ChangeWebsiteStrategyApprovalStatusDto = z.infer<
  typeof changeWebsiteStrategyApprovalStatusSchema
>;
