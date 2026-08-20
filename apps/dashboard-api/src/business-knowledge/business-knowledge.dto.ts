import { z } from "zod";

// Mirrors packages/database/src/business-knowledge/entities.ts's BusinessKnowledgeRecordType —
// see docs/task-packages/module-business-knowledge-center.md D5.
const RECORD_TYPES = [
  "company_profile",
  "persona_icp",
  "marketing_profile",
  "vto",
  "service_taxonomy",
  "engagement_model",
  "approved_messaging",
  "competitor",
  "geographic_scope",
  "strategic_priority",
] as const;

const RECORD_STATUSES = ["mandatory", "advisory", "draft", "deprecated", "restricted"] as const;

export const recordTypeSchema = z.enum(RECORD_TYPES);
export const recordStatusSchema = z.enum(RECORD_STATUSES);

export const listBusinessKnowledgeRecordsQuerySchema = z.object({
  recordType: recordTypeSchema.optional(),
  status: recordStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListBusinessKnowledgeRecordsQueryDto = z.infer<
  typeof listBusinessKnowledgeRecordsQuerySchema
>;

// Raised from 50_000 (`business-knowledge-center-rich-content-attachments.md`) — `content` is now
// HTML from the rich-text editor, which carries real markup overhead over the equivalent plain
// text; still a bounded ceiling, not unlimited.
const CONTENT_MAX_LENGTH = 100_000;

export const createBusinessKnowledgeRecordSchema = z.object({
  recordType: recordTypeSchema,
  title: z.string().min(1).max(255),
  // Optional, not required — a record can legitimately be created with no typed content at all
  // when the author's actual intent is to attach a file right after creation (attachments can
  // only target a record that already exists, so "create empty, then attach" is a real, valid
  // flow, not an oversight).
  content: z.string().max(CONTENT_MAX_LENGTH).optional(),
  notes: z.string().max(10_000).nullish(),
});
export type CreateBusinessKnowledgeRecordDto = z.infer<typeof createBusinessKnowledgeRecordSchema>;

// recordType is deliberately not updatable — reclassifying an existing record's type is a data
// question this V1 doesn't handle; create a new record instead.
export const updateBusinessKnowledgeRecordSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().max(CONTENT_MAX_LENGTH).optional(),
  notes: z.string().max(10_000).nullish(),
});
export type UpdateBusinessKnowledgeRecordDto = z.infer<typeof updateBusinessKnowledgeRecordSchema>;

export const changeBusinessKnowledgeRecordStatusSchema = z.object({
  status: recordStatusSchema,
});
export type ChangeBusinessKnowledgeRecordStatusDto = z.infer<
  typeof changeBusinessKnowledgeRecordStatusSchema
>;

/** The client sends only what it cannot re-derive itself — the pathname it uploaded to and the
 *  original filename (Blob's own pathname carries a random suffix, `addRandomSuffix: true`, so
 *  the human-readable name is lost unless sent separately). `contentType`/`sizeBytes`/checksum
 *  are all computed server-side from the actually-downloaded object, never trusted from the
 *  client — see `business-knowledge-attachments.service.ts`. */
export const confirmBusinessKnowledgeAttachmentSchema = z.object({
  pathname: z.string().min(1).max(1024),
  filename: z.string().min(1).max(255),
});
export type ConfirmBusinessKnowledgeAttachmentDto = z.infer<
  typeof confirmBusinessKnowledgeAttachmentSchema
>;
