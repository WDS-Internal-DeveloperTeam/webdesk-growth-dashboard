import { z } from "zod";

// Mirrors packages/database/src/workflow-and-task-template-library/entities.ts's
// WorkflowTaskTemplateType.
const TEMPLATE_TYPE_VALUES = [
  "existing_page_audit",
  "new_page_opportunity",
  "search_brief",
  "content",
  "case_study",
  "design",
  "development",
  "code_review",
  "security",
  "qa",
  "release",
] as const;

export const workflowTaskTemplateTypeSchema = z.enum(TEMPLATE_TYPE_VALUES);

// Mirrors packages/database/src/workflow-and-task-template-library/entities.ts's
// WorkflowTaskTemplateApprovalStatus — reused verbatim from Brand Library's/Content Template
// Library's/Persona Library's/Service Library's own identical ArtifactApprovalStatus union.
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

export const workflowTaskTemplateApprovalStatusSchema = z.enum(APPROVAL_STATUS_VALUES);

// `.nullish()` so an explicit `null` can clear a field on update, same convention every sibling
// module's own text fields use. `requiredInputs`/`expectedOutputs`/`restrictions`/
// `validationCriteria` render via `RichTextEditor` in `dashboard-web` (2026-08-22 standing rule)
// and are sanitized at write time in the service — the cap is raised 2x over the original
// backend-only pass's plain-text limit to absorb markup overhead, matching every sibling
// module's own identical rich-text-conversion ratio.
const LONG_TEXT_MAX_LENGTH = 8000;
const longTextField = z.string().max(LONG_TEXT_MAX_LENGTH).nullish();

export const listWorkflowTaskTemplatesQuerySchema = z.object({
  templateType: workflowTaskTemplateTypeSchema.optional(),
  approvalStatus: workflowTaskTemplateApprovalStatusSchema.optional(),
  search: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type ListWorkflowTaskTemplatesQueryDto = z.infer<
  typeof listWorkflowTaskTemplatesQuerySchema
>;

export const createWorkflowTaskTemplateSchema = z.object({
  publicId: z.string().min(1).max(64),
  templateType: workflowTaskTemplateTypeSchema,
  title: z.string().min(1).max(255),
  authorizedStage: z.string().min(1).max(255),
  requiredInputs: longTextField,
  expectedOutputs: longTextField,
  // Descriptive metadata only (e.g. "cannot authorize execution by itself") — never read by any
  // status-transition or execution gate in this codebase (the roadmap's own "Templates never
  // authorize execution by themselves" note).
  restrictions: longTextField,
  agentAssignment: z.string().max(255).nullish(),
  validationCriteria: longTextField,
  // Plain descriptive text (e.g. "requires QA sign-off before release") — never wired to any
  // automatic status transition.
  requiredApprovals: z.string().max(500).nullish(),
});
export type CreateWorkflowTaskTemplateDto = z.infer<typeof createWorkflowTaskTemplateSchema>;

// publicId and templateType are both create-only (immutable after create — changing templateType
// after creation would be a different record). approvalStatus and version are deliberately not
// accepted here — approvalStatus only changes via the dedicated status-transition route, and
// version is server-managed, incremented automatically on every successful update. Derived from
// createWorkflowTaskTemplateSchema (mirrors updateBrandLibraryRecordSchema's own precedent)
// rather than hand-retyped, so `title`'s own constraints stay in exactly one place too.
export const updateWorkflowTaskTemplateSchema = createWorkflowTaskTemplateSchema
  .omit({ publicId: true, templateType: true })
  .partial()
  // Rejects a genuinely empty patch (`{}`) with a clean 400 instead of silently succeeding as a
  // no-op that still burns a `version` increment (matches updateBrandLibraryRecordSchema's own
  // precedent).
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });
export type UpdateWorkflowTaskTemplateDto = z.infer<typeof updateWorkflowTaskTemplateSchema>;

export const changeWorkflowTaskTemplateApprovalStatusSchema = z.object({
  approvalStatus: workflowTaskTemplateApprovalStatusSchema,
});
export type ChangeWorkflowTaskTemplateApprovalStatusDto = z.infer<
  typeof changeWorkflowTaskTemplateApprovalStatusSchema
>;
