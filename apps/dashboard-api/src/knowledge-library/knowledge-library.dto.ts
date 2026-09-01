import { z } from "zod";

const STATUSES = ["draft", "mandatory", "advisory", "deprecated"] as const;
const CONFIDENTIALITY_VALUES = ["public", "internal", "restricted"] as const;

export const knowledgeLibraryStatusSchema = z.enum(STATUSES);
export const knowledgeLibraryConfidentialitySchema = z.enum(CONFIDENTIALITY_VALUES);

// `?activeStatus=false` naively coerced via `z.coerce.boolean()` would resolve to `true` (any
// non-empty string is truthy) — an explicit "true"/"false" literal map has no such trap. Same
// pattern as operational-contacts.dto.ts's own `booleanQueryParam`.
const booleanQueryParam = z.enum(["true", "false"]).transform((value) => value === "true");

export const listKnowledgeLibraryRecordsQuerySchema = z.object({
  sourceType: z.string().min(1).max(100).optional(),
  status: knowledgeLibraryStatusSchema.optional(),
  confidentiality: knowledgeLibraryConfidentialitySchema.optional(),
  approvedForAgentUse: booleanQueryParam.optional(),
  // Mirrors BusinessKnowledgeCenter's own DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT bound (50/200).
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListKnowledgeLibraryRecordsQueryDto = z.infer<
  typeof listKnowledgeLibraryRecordsQuerySchema
>;

const RELATED_ENTITY_IDS_MAX = 100;

export const createKnowledgeLibraryRecordSchema = z.object({
  title: z.string().min(1).max(255),
  // D4 — plain free text, no taxonomy exists anywhere in the canonical spec.
  sourceType: z.string().max(100).nullish(),
  // D5 — plain text, not URL-validated; a reference source's location may genuinely be a URL, an
  // internal file path, or a citation.
  location: z.string().max(2048).nullish(),
  // D6 — existence-validated server-side in the service before write.
  ownerUserId: z.string().uuid().nullish(),
  sourceDate: z.string().date().nullish(),
  confidentiality: knowledgeLibraryConfidentialitySchema.optional(),
  approvedForAgentUse: z.boolean().optional(),
  notes: z.string().max(10_000).nullish(),
  // D7 — plain, unvalidated string array.
  relatedEntityIds: z.array(z.string().min(1).max(255)).max(RELATED_ENTITY_IDS_MAX).nullish(),
  // D9 — a plain, caller-settable nullable timestamp; no dedicated "mark reviewed" action exists.
  lastReviewedAt: z.string().datetime().nullish(),
});
export type CreateKnowledgeLibraryRecordDto = z.infer<typeof createKnowledgeLibraryRecordSchema>;

// `status` is deliberately never accepted here — only the dedicated transition route may change
// it (mirrors updateBusinessKnowledgeRecordSchema's own precedent). `confidentiality` IS a plain
// editable field here (unlike `status`) — the spec describes no workflow for it, only for
// mandatory/advisory.
export const updateKnowledgeLibraryRecordSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  sourceType: z.string().max(100).nullish(),
  location: z.string().max(2048).nullish(),
  ownerUserId: z.string().uuid().nullish(),
  sourceDate: z.string().date().nullish(),
  confidentiality: knowledgeLibraryConfidentialitySchema.optional(),
  approvedForAgentUse: z.boolean().optional(),
  notes: z.string().max(10_000).nullish(),
  relatedEntityIds: z.array(z.string().min(1).max(255)).max(RELATED_ENTITY_IDS_MAX).nullish(),
  lastReviewedAt: z.string().datetime().nullish(),
});
export type UpdateKnowledgeLibraryRecordDto = z.infer<typeof updateKnowledgeLibraryRecordSchema>;

export const changeKnowledgeLibraryRecordStatusSchema = z.object({
  status: knowledgeLibraryStatusSchema,
});
export type ChangeKnowledgeLibraryRecordStatusDto = z.infer<
  typeof changeKnowledgeLibraryRecordStatusSchema
>;
