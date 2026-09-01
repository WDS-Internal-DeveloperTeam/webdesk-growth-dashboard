import type {
  WorkflowTaskTemplateApprovalStatus,
  WorkflowTaskTemplateType,
} from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import {
  ARTIFACT_APPROVAL_STATUS_LABEL,
  ARTIFACT_APPROVAL_STATUS_VALUES,
  artifactApprovalStatusBadge,
} from "./artifact-approval-status";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `WorkflowTaskTemplateQuery`/`parseWorkflowTaskTemplateSearchParams`/
 * `buildWorkflowTaskTemplateHref` live in their own file with zero non-type imports, rather than
 * in `lib/workflow-and-task-template-library.ts` where the server-side fetch functions live — so a
 * `"use client"` component (the create/edit form, the status-actions island) can import the real
 * functions directly without pulling in `lib/workflow-and-task-template-library.ts`'s
 * `next/headers` import. Same precedent as `lib/brand-library-query.ts`/
 * `lib/persona-library-query.ts`.
 */

// WorkflowTaskTemplateApprovalStatus is structurally identical to ArtifactApprovalStatus (the
// shared 8-value workflow every sibling module reuses) — reused directly rather than re-declared
// here, matching every sibling module's own precedent for this shared vocabulary.
const APPROVAL_STATUS_VALUES: readonly WorkflowTaskTemplateApprovalStatus[] =
  ARTIFACT_APPROVAL_STATUS_VALUES;

export const APPROVAL_STATUS_LABEL: Readonly<Record<WorkflowTaskTemplateApprovalStatus, string>> =
  ARTIFACT_APPROVAL_STATUS_LABEL;

export function workflowTaskTemplateApprovalStatusBadge(
  status: WorkflowTaskTemplateApprovalStatus,
): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return artifactApprovalStatusBadge(status);
}

export const TEMPLATE_TYPE_VALUES: readonly WorkflowTaskTemplateType[] = [
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
];

export const TEMPLATE_TYPE_LABEL: Readonly<Record<WorkflowTaskTemplateType, string>> = {
  existing_page_audit: "Existing page audit",
  new_page_opportunity: "New page opportunity",
  search_brief: "Search brief",
  content: "Content",
  case_study: "Case study",
  design: "Design",
  development: "Development",
  code_review: "Code review",
  security: "Security",
  qa: "QA",
  release: "Release",
};

export interface WorkflowTaskTemplateQuery {
  readonly templateType: WorkflowTaskTemplateType | null;
  readonly approvalStatus: WorkflowTaskTemplateApprovalStatus | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same values
 * `GET /workflow-and-task-template-library/templates` itself accepts
 * (`apps/dashboard-api/src/workflow-and-task-template-library/workflow-and-task-template-library.dto.ts`'s
 * `listWorkflowTaskTemplatesQuerySchema`) rather than passed through raw, so a garbled URL degrades
 * to the default query instead of round-tripping an invalid value to the backend. No `sortBy`/
 * `sortOrder` param — the backend's `list()` supports neither.
 */
export function parseWorkflowTaskTemplateSearchParams(
  raw: Record<string, string | string[] | undefined>,
): WorkflowTaskTemplateQuery {
  const templateType = firstValue(raw.templateType);
  const approvalStatus = firstValue(raw.approvalStatus);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    templateType: TEMPLATE_TYPE_VALUES.includes(templateType as WorkflowTaskTemplateType)
      ? (templateType as WorkflowTaskTemplateType)
      : null,
    approvalStatus: APPROVAL_STATUS_VALUES.includes(
      approvalStatus as WorkflowTaskTemplateApprovalStatus,
    )
      ? (approvalStatus as WorkflowTaskTemplateApprovalStatus)
      : null,
    // Clamped to the same 255-char max the backend's own listWorkflowTaskTemplatesQuerySchema
    // enforces — matches every sibling list page's own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/workflow-and-task-template-library?...` href — `overrides` wins over `current`, and
 * changing anything other than `offset` itself resets `offset` to 0, same convention as
 * `buildBrandLibraryHref`/`buildPersonaLibraryHref`.
 */
export function buildWorkflowTaskTemplateHref(
  current: WorkflowTaskTemplateQuery,
  overrides: Partial<WorkflowTaskTemplateQuery>,
): string {
  const next: WorkflowTaskTemplateQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.templateType) params.set("templateType", next.templateType);
  if (next.approvalStatus) params.set("approvalStatus", next.approvalStatus);
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString
    ? `/workflow-and-task-template-library?${queryString}`
    : "/workflow-and-task-template-library";
}

export { APPROVAL_STATUS_VALUES };
