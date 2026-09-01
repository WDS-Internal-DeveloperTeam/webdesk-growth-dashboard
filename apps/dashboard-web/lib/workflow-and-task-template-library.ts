import { cookies } from "next/headers";
import type { ApiSuccessResponse, WorkflowTaskTemplate } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import { isUuid } from "./uuid";
import {
  APPROVAL_STATUS_LABEL,
  buildWorkflowTaskTemplateHref,
  parseWorkflowTaskTemplateSearchParams,
  TEMPLATE_TYPE_LABEL,
  TEMPLATE_TYPE_VALUES,
  workflowTaskTemplateApprovalStatusBadge,
  type WorkflowTaskTemplateQuery,
} from "./workflow-and-task-template-library-query";

export {
  APPROVAL_STATUS_LABEL,
  buildWorkflowTaskTemplateHref,
  formatTimestamp,
  parseWorkflowTaskTemplateSearchParams,
  TEMPLATE_TYPE_LABEL,
  TEMPLATE_TYPE_VALUES,
  workflowTaskTemplateApprovalStatusBadge,
};
export type { WorkflowTaskTemplateQuery };

export interface WorkflowTaskTemplateListResult {
  readonly items: readonly WorkflowTaskTemplate[];
  /** Same "request one row past the chosen page size" technique `getBrandLibraryRecords()`/
   *  `getPersonas()`/`getServices()` use — `GET /workflow-and-task-template-library/templates`
   *  returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the template list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  `getBrandLibraryRecords()`'s own precedent. */
export async function getWorkflowTaskTemplates(
  query: WorkflowTaskTemplateQuery,
): Promise<WorkflowTaskTemplateListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.templateType) params.set("templateType", query.templateType);
  if (query.approvalStatus) params.set("approvalStatus", query.approvalStatus);
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/workflow-and-task-template-library/templates?${params.toString()}`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to load workflow task templates (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly WorkflowTaskTemplate[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches one workflow task template. Returns `null` on a 404 (the caller renders `notFound()`) or
 * a malformed id (rejected via `isUuid()` before any network call, the same short-circuit
 * `getBrandLibraryRecord()`/`getPersona()`/`getService()` use), and throws on any other non-OK
 * status (403/5xx).
 */
export async function getWorkflowTaskTemplate(
  templateId: string,
): Promise<WorkflowTaskTemplate | null> {
  if (!isUuid(templateId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(
    `${apiBaseUrl}/workflow-and-task-template-library/templates/${templateId}`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load workflow task template (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<WorkflowTaskTemplate>).data;
}
