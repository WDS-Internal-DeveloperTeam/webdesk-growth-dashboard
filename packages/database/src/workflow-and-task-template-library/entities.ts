/**
 * The Workflow and Task Template Library module foundation — persistence-layer shapes for
 * `workflow_task_templates` (migration `00099`, module `workflow_and_task_template_library`). A
 * single table, matching Business Knowledge Center's/Persona Library's/Service Library's/Content
 * Template Library's/Brand Library's own single-generic-table precedent. Organization-wide, not
 * project-scoped — no `project_id` column, mirroring Brand Library's own reasoning (these
 * templates are not tied to a single client project).
 */

/** The 11 template kinds named by `03_Detailed_Module_Specifications.md` for this module — a
 *  discriminator column, mirroring Brand Library's own `record_type` shape. Create-only/immutable
 *  across edits (a real type change means a new record), same rule Brand Library's `recordType`
 *  follows. */
export type WorkflowTaskTemplateType =
  | "existing_page_audit"
  | "new_page_opportunity"
  | "search_brief"
  | "content"
  | "case_study"
  | "design"
  | "development"
  | "code_review"
  | "security"
  | "qa"
  | "release";

/** Reused verbatim (byte-for-byte) from Brand Library's/Content Template Library's/Persona
 *  Library's/Service Library's own identical `ArtifactApprovalStatus` union — the accepted,
 *  already-flagged tracked-debt duplication pattern; a shared helper for a further consumer
 *  remains disproportionate for a single-module pass, per every prior module's own identical
 *  reasoning. */
export type WorkflowTaskTemplateApprovalStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "revision_requested"
  | "rejected"
  | "superseded"
  | "archived";

/**
 * The primary entity. Every long-text field
 * (`requiredInputs`/`expectedOutputs`/`restrictions`/`validationCriteria`) is stored as plain,
 * unsanitized text — this is a backend-only pass with no `dashboard-web` UI yet, matching
 * Persona Library's/Service Library's own original backend-only builds; rich-text sanitization is
 * added later alongside the UI, per this project's own standing rule (see `CLAUDE.md`
 * "Cautions").
 *
 * `restrictions` deliberately never gates any code path here — the roadmap's own explicit design
 * note ("Templates never authorize execution by themselves") is honored by NOT wiring this field
 * (or `requiredApprovals`) to any automatic status transition or execution check; both are inert,
 * descriptive metadata only.
 */
export interface WorkflowTaskTemplateEntity {
  readonly id: string;
  readonly publicId: string;
  readonly templateType: WorkflowTaskTemplateType;
  readonly title: string;
  readonly authorizedStage: string;
  readonly requiredInputs: string | null;
  readonly expectedOutputs: string | null;
  readonly restrictions: string | null;
  readonly agentAssignment: string | null;
  readonly validationCriteria: string | null;
  readonly requiredApprovals: string | null;
  readonly approvalStatus: WorkflowTaskTemplateApprovalStatus;
  /** Server-managed, incremented by 1 on every successful content `update()` (never on a
   *  status-transition call) — mirrors Brand Library's own `version` contract. */
  readonly version: number;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
