import { z } from "zod";

// Mirrors packages/database/src/keyword-and-entity-library/entities.ts's KeywordApprovalStatus —
// identical vocabulary to Service/Persona/Proof-and-Claims/Website-Strategy-Center/Page-Inventory's
// own, reused verbatim (task package D9).
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
export const keywordApprovalStatusSchema = z.enum(APPROVAL_STATUS_VALUES);

const CONFIDENCE_VALUES = ["low", "medium", "high"] as const;
export const keywordConfidenceSchema = z.enum(CONFIDENCE_VALUES);

const shortTextField = z.string().max(255).nullish();
const longTextField = z.string().max(20_000).nullish();
const dateOnlyField = z.string().date().nullish();

// --- keywords ---

// `projectId` is deliberately NOT a field here — keywords are project-scoped (task package D2),
// and the project id comes exclusively from the `:projectId` route path segment
// (`keyword-and-entity-library/projects/:projectId/keywords`), never from a client-supplied query
// param — mirrors the already-fixed lesson Page Inventory's own listPagesQuerySchema/createPageSchema
// doc comments record (PermissionGuard only ever reads `request.params?.projectId`).
export const listKeywordsQuerySchema = z.object({
  keywordType: z.string().max(100).optional(),
  intent: z.string().max(100).optional(),
  funnelStage: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  confidence: keywordConfidenceSchema.optional(),
  approvalStatus: keywordApprovalStatusSchema.optional(),
  search: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListKeywordsQueryDto = z.infer<typeof listKeywordsQuerySchema>;

export const createKeywordSchema = z.object({
  publicId: z.string().min(1).max(64),
  queryText: z.string().min(1).max(500),
  keywordType: shortTextField,
  intent: shortTextField,
  funnelStage: shortTextField,
  country: shortTextField,
  searchVolume: z.number().int().min(0).nullish(),
  difficultyScore: z.number().int().min(0).max(100).nullish(),
  source: z.string().max(200).nullish(),
  researchDate: dateOnlyField,
  cannibalizationNotes: longTextField,
  confidence: keywordConfidenceSchema.nullish(),
});
export type CreateKeywordDto = z.infer<typeof createKeywordSchema>;

// projectId/publicId are never accepted here — both immutable after creation (a keyword never
// moves between projects). approvalStatus is likewise never accepted — only the dedicated
// status-transition route may change it, same discipline as every sibling module's own update
// schema.
export const updateKeywordSchema = z
  .object({
    queryText: z.string().min(1).max(500).optional(),
    keywordType: shortTextField,
    intent: shortTextField,
    funnelStage: shortTextField,
    country: shortTextField,
    searchVolume: z.number().int().min(0).nullish(),
    difficultyScore: z.number().int().min(0).max(100).nullish(),
    source: z.string().max(200).nullish(),
    researchDate: dateOnlyField,
    cannibalizationNotes: longTextField,
    confidence: keywordConfidenceSchema.nullish(),
  })
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op that still writes an essentially-empty audit event, mirroring every sibling module's own
  // identical fix (Page Inventory's updatePageSchema, Persona Library's updatePersonaSchema, ...).
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateKeywordDto = z.infer<typeof updateKeywordSchema>;

export const changeKeywordApprovalStatusSchema = z.object({
  approvalStatus: keywordApprovalStatusSchema,
});
export type ChangeKeywordApprovalStatusDto = z.infer<typeof changeKeywordApprovalStatusSchema>;

// --- entities ---

export const listEntitiesQuerySchema = z.object({
  entityType: z.string().max(100).optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListEntitiesQueryDto = z.infer<typeof listEntitiesQuerySchema>;

export const createEntitySchema = z.object({
  publicId: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  entityType: shortTextField,
  description: longTextField,
});
export type CreateEntityDto = z.infer<typeof createEntitySchema>;

export const updateEntitySchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    entityType: shortTextField,
    description: longTextField,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateEntityDto = z.infer<typeof updateEntitySchema>;

// --- keyword_entity_relationships (join sub-resource) ---

export const createKeywordEntityRelationshipSchema = z.object({
  entityId: z.string().uuid(),
});
export type CreateKeywordEntityRelationshipDto = z.infer<
  typeof createKeywordEntityRelationshipSchema
>;

// --- page_keyword_assignments (join sub-resource) ---

export const createPageKeywordAssignmentSchema = z.object({
  pageId: z.string().uuid(),
  assignmentNote: z.string().max(500).nullish(),
});
export type CreatePageKeywordAssignmentDto = z.infer<typeof createPageKeywordAssignmentSchema>;
