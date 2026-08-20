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
});
export type ListBusinessKnowledgeRecordsQueryDto = z.infer<
  typeof listBusinessKnowledgeRecordsQuerySchema
>;

export const createBusinessKnowledgeRecordSchema = z.object({
  recordType: recordTypeSchema,
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(50_000),
  notes: z.string().max(10_000).nullish(),
});
export type CreateBusinessKnowledgeRecordDto = z.infer<typeof createBusinessKnowledgeRecordSchema>;

// recordType is deliberately not updatable — reclassifying an existing record's type is a data
// question this V1 doesn't handle; create a new record instead.
export const updateBusinessKnowledgeRecordSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().min(1).max(50_000).optional(),
  notes: z.string().max(10_000).nullish(),
});
export type UpdateBusinessKnowledgeRecordDto = z.infer<typeof updateBusinessKnowledgeRecordSchema>;

export const changeBusinessKnowledgeRecordStatusSchema = z.object({
  status: recordStatusSchema,
});
export type ChangeBusinessKnowledgeRecordStatusDto = z.infer<
  typeof changeBusinessKnowledgeRecordStatusSchema
>;
