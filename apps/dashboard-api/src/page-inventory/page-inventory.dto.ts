import { z } from "zod";
import { safeHttpUrlSchema } from "@webdesk/validation";

// Mirrors packages/database/src/page-inventory/entities.ts's PageWorkflowStage — identical
// vocabulary to Service/Persona/Proof-and-Claims/Website-Strategy-Center's own, reused verbatim
// (task package D8).
const WORKFLOW_STAGE_VALUES = [
  "draft",
  "submitted",
  "under_review",
  "approved",
  "revision_requested",
  "rejected",
  "superseded",
  "archived",
] as const;
export const pageWorkflowStageSchema = z.enum(WORKFLOW_STAGE_VALUES);

const EXISTING_OR_PROPOSED_VALUES = ["existing", "proposed"] as const;
export const pageExistingOrProposedSchema = z.enum(EXISTING_OR_PROPOSED_VALUES);

const INDEX_STATUS_VALUES = ["index", "noindex", "unknown"] as const;
export const pageIndexStatusSchema = z.enum(INDEX_STATUS_VALUES);

// Roadmap-sourced only (task package D9), not spec-sourced — see entities.ts's PageClassification
// doc comment.
const CLASSIFICATION_VALUES = [
  "keep",
  "optimize",
  "restructure",
  "redesign",
  "rebuild",
  "consolidate",
] as const;
export const pageClassificationSchema = z.enum(CLASSIFICATION_VALUES);

const shortTextField = z.string().max(255).nullish();
// repository_files has no defined structure (task package D-none) — a plain, generously-bounded
// text field, not TEXT-max-length, matching the pattern this codebase already uses for genuinely
// unstructured long text (ProofClaimEntity's beforeValue/afterValue-style fields stay short;
// this one is closer to a free-form notes field).
const longTextField = z.string().max(20_000).nullish();
const dateOnlyField = z.string().date().nullish();

export const listPagesQuerySchema = z.object({
  // Required — pages are project-scoped (task package D2); there is no cross-project "list every
  // page" concept in this module (design decision, not spec-sourced — flagged in the task
  // report). Every other filter below mirrors the spec's own §5 "Filters" list, except "owner":
  // the spec's own required-fields list for this module names no owner field at all, so it has no
  // backing column to filter by — omitted rather than fabricated.
  projectId: z.string().uuid(),
  pageType: z.string().max(255).optional(),
  workflowStage: pageWorkflowStageSchema.optional(),
  roadmapPhaseId: z.string().uuid().optional(),
  indexStatus: pageIndexStatusSchema.optional(),
  template: z.string().max(255).optional(),
  search: z.string().max(255).optional(),
  targetKeyword: z.string().max(255).optional(),
  lastScanBefore: z.string().date().optional(),
  lastScanAfter: z.string().date().optional(),
  lastDeploymentBefore: z.string().date().optional(),
  lastDeploymentAfter: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListPagesQueryDto = z.infer<typeof listPagesQuerySchema>;

export const createPageSchema = z.object({
  projectId: z.string().uuid(),
  publicId: z.string().min(1).max(64),
  pageName: z.string().min(1).max(20_000),
  pageType: shortTextField,
  existingOrProposed: pageExistingOrProposedSchema.optional(),
  indexStatus: pageIndexStatusSchema.optional(),
  template: shortTextField,
  roadmapPhaseId: z.string().uuid().nullish(),
  targetKeyword: shortTextField,
  designVersion: shortTextField,
  repositoryFiles: longTextField,
  wordpressPageId: shortTextField,
  wordpressPostId: shortTextField,
  lastScanAt: dateOnlyField,
  lastDeploymentAt: dateOnlyField,
  classification: pageClassificationSchema.nullish(),
});
export type CreatePageDto = z.infer<typeof createPageSchema>;

// projectId/publicId are never accepted here — both immutable after creation (a page never moves
// between projects, matching how a project's own publicId is never regenerated once assigned).
// workflowStage is likewise never accepted — only the dedicated status-transition route may
// change it, same discipline as every sibling module's own update schema.
export const updatePageSchema = z
  .object({
    pageName: z.string().min(1).max(20_000).optional(),
    pageType: shortTextField,
    existingOrProposed: pageExistingOrProposedSchema.optional(),
    indexStatus: pageIndexStatusSchema.optional(),
    template: shortTextField,
    roadmapPhaseId: z.string().uuid().nullish(),
    targetKeyword: shortTextField,
    designVersion: shortTextField,
    repositoryFiles: longTextField,
    wordpressPageId: shortTextField,
    wordpressPostId: shortTextField,
    lastScanAt: dateOnlyField,
    lastDeploymentAt: dateOnlyField,
    classification: pageClassificationSchema.nullish(),
  })
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op that still writes an essentially-empty audit event, mirroring every sibling module's own
  // identical fix (Persona Library's updatePersonaSchema, Proof and Claims Library's
  // updateProofClaimSchema, Website Strategy Center's updateWebsiteStrategyRecordSchema).
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdatePageDto = z.infer<typeof updatePageSchema>;

export const changePageWorkflowStageSchema = z.object({
  workflowStage: pageWorkflowStageSchema,
});
export type ChangePageWorkflowStageDto = z.infer<typeof changePageWorkflowStageSchema>;

// --- page_urls (child sub-resource) ---

// safeHttpUrlSchema (@webdesk/validation), not a bare z.string().url() — a stored `javascript:`
// value here would be a real stored-XSS vector once any future dashboard-web UI renders a URL as
// a clickable link, the exact class of finding Projects' own environment.url and Proof and Claims
// Library's own sourceUrl each shipped once and had to fix (Proof and Claims Library's own dto
// doc comment records the same lesson this field applies from day one).
export const createPageUrlSchema = z.object({
  url: safeHttpUrlSchema,
  isCanonical: z.boolean().optional(),
});
export type CreatePageUrlDto = z.infer<typeof createPageUrlSchema>;

export const updatePageUrlSchema = z
  .object({
    url: safeHttpUrlSchema.optional(),
    isCanonical: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdatePageUrlDto = z.infer<typeof updatePageUrlSchema>;
