import { z } from "zod";

// Mirrors packages/database/src/internal-linking-library/entities.ts's InternalLinkStatus — a
// genuinely bespoke 4-state workflow (task package D1), NOT the 8-value generic artifact
// lifecycle every prior module reuses.
const STATUS_VALUES = ["proposed", "approved", "implemented", "verified"] as const;
export const internalLinkStatusSchema = z.enum(STATUS_VALUES);

const PRIORITY_VALUES = ["low", "medium", "high"] as const;
export const internalLinkPrioritySchema = z.enum(PRIORITY_VALUES);

// Matches the real VARCHAR(255) columns (migration 00062) this backs
// (relationship/anchor/linkType/detector).
const shortTextField = z.string().max(255).nullish();
// context gets a generously-sized TEXT column at the DB layer, capped here at 2000 chars
// (task package D5) — a placement/surrounding-context description could reasonably run to a
// paragraph, but is not open-ended free text the way a rich-text field would be. No dashboard-web
// UI exists yet in this pass, so no rich-text-editor/sanitization wiring applies here (the
// 2026-08-22 standing rule is scoped to dashboard-web long-text fields).
const contextField = z.string().max(2000).nullish();

// --- internal_links ---

// `projectId` is deliberately NOT a field here — links are project-scoped (task package D3), and
// the project id comes exclusively from the `:projectId` route path segment
// (`internal-linking-library/projects/:projectId/links`), never from a client-supplied query
// param — mirrors the already-fixed lesson Page Inventory's/Keyword & Entity Library's own
// listPagesQuerySchema/listKeywordsQuerySchema doc comments record (PermissionGuard only ever
// reads `request.params?.projectId`).
export const listInternalLinksQuerySchema = z.object({
  sourcePageId: z.string().uuid().optional(),
  targetPageId: z.string().uuid().optional(),
  status: internalLinkStatusSchema.optional(),
  priority: internalLinkPrioritySchema.optional(),
  linkType: z.string().max(255).optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListInternalLinksQueryDto = z.infer<typeof listInternalLinksQuerySchema>;

export const createInternalLinkSchema = z.object({
  publicId: z.string().min(1).max(64),
  sourcePageId: z.string().uuid(),
  targetPageId: z.string().uuid(),
  relationship: shortTextField,
  anchor: shortTextField,
  context: contextField,
  linkType: shortTextField,
  priority: internalLinkPrioritySchema.nullish(),
  detector: shortTextField,
  assignedApproverUserId: z.string().uuid().nullish(),
  // Deliberately NOT validated against website_strategy_records (task package D8) — a plain,
  // unvalidated uuid-shaped string, mirroring Service Library's icpIds/Persona Library's
  // relatedServiceIds-before-their-targets-existed precedent.
  relatedStrategyRecordId: z.string().uuid().nullish(),
});
export type CreateInternalLinkDto = z.infer<typeof createInternalLinkSchema>;

// projectId/publicId are never accepted here — both immutable after creation (a link never moves
// between projects, and its own identity never changes). status/implementedAt/verifiedAt are
// likewise never accepted — only the dedicated status-transition route may change status, and
// implementedAt/verifiedAt are server-stamped exclusively by that route's own atomic write
// (task package D2). sourcePageId/targetPageId ARE editable here (unlike publicId/projectId) — a
// link's source/target may be corrected after creation, re-validated the same way as on create.
export const updateInternalLinkSchema = z
  .object({
    sourcePageId: z.string().uuid().optional(),
    targetPageId: z.string().uuid().optional(),
    relationship: shortTextField,
    anchor: shortTextField,
    context: contextField,
    linkType: shortTextField,
    priority: internalLinkPrioritySchema.nullish(),
    detector: shortTextField,
    assignedApproverUserId: z.string().uuid().nullish(),
    relatedStrategyRecordId: z.string().uuid().nullish(),
  })
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op that still writes an essentially-empty audit event, mirroring every sibling module's own
  // identical fix (Keyword & Entity Library's updateKeywordSchema, Page Inventory's
  // updatePageSchema, ...).
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateInternalLinkDto = z.infer<typeof updateInternalLinkSchema>;

export const changeInternalLinkStatusSchema = z.object({
  status: internalLinkStatusSchema,
});
export type ChangeInternalLinkStatusDto = z.infer<typeof changeInternalLinkStatusSchema>;
