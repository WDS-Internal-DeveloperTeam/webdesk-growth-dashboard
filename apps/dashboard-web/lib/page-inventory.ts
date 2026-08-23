import { cookies } from "next/headers";
import type { ApiSuccessResponse, Page, PageUrl } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import {
  buildPageInventoryHref,
  CLASSIFICATION_LABEL,
  EXISTING_OR_PROPOSED_LABEL,
  INDEX_STATUS_LABEL,
  pageWorkflowStageBadge,
  parsePageInventorySearchParams,
  withProjectId,
  WORKFLOW_STAGE_LABEL,
  type PageInventoryQuery,
} from "./page-inventory-query";
import { isUuid } from "./uuid";

export {
  buildPageInventoryHref,
  CLASSIFICATION_LABEL,
  EXISTING_OR_PROPOSED_LABEL,
  formatTimestamp,
  INDEX_STATUS_LABEL,
  pageWorkflowStageBadge,
  parsePageInventorySearchParams,
  withProjectId,
  WORKFLOW_STAGE_LABEL,
};
export type { PageInventoryQuery };

export interface PageListResult {
  readonly items: readonly Page[];
  /** Same "request one row past the chosen page size" technique `getProjects()`/`getServices()`/
   *  `getPersonas()`/`getProofClaims()` use — `GET .../pages` returns no total count to check
   *  against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the page list (once a project is
 *  selected), so a fetch failure must surface as a real error state (propagates to the nearest
 *  `error.tsx`), matching every sibling module's own list-fetch precedent. */
export async function getPages(query: PageInventoryQuery): Promise<PageListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.pageType) params.set("pageType", query.pageType);
  if (query.workflowStage) params.set("workflowStage", query.workflowStage);
  if (query.indexStatus) params.set("indexStatus", query.indexStatus);
  if (query.template) params.set("template", query.template);
  if (query.search) params.set("search", query.search);
  if (query.targetKeyword) params.set("targetKeyword", query.targetKeyword);
  if (query.roadmapPhaseId) params.set("roadmapPhaseId", query.roadmapPhaseId);
  if (query.lastScanBefore) params.set("lastScanBefore", query.lastScanBefore);
  if (query.lastScanAfter) params.set("lastScanAfter", query.lastScanAfter);
  if (query.lastDeploymentBefore) params.set("lastDeploymentBefore", query.lastDeploymentBefore);
  if (query.lastDeploymentAfter) params.set("lastDeploymentAfter", query.lastDeploymentAfter);
  // One row past the chosen page size — see PageListResult.hasNextPage's own doc comment.
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/page-inventory/projects/${query.projectId}/pages?${params.toString()}`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to load pages (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly Page[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches one page. Returns `null` on a 404 (the caller renders `notFound()`) or a malformed
 * `projectId`/`pageId` (rejected via `isUuid()` before any network call, the same short-circuit
 * `getProject()`/`getService()`/`getPersona()` use), and throws on any other non-OK status (403/5xx).
 */
export async function getPage(projectId: string, pageId: string): Promise<Page | null> {
  if (!isUuid(projectId) || !isUuid(pageId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(
    `${apiBaseUrl}/page-inventory/projects/${projectId}/pages/${pageId}`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load page (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<Page>).data;
}

/**
 * Fetches a page's own URLs sub-resource, for the detail page's "Page URLs" section. Returns an
 * empty array on a malformed id (the same short-circuit `getPage()` uses), a 404, OR any other
 * non-OK status (a transient backend error) — a genuine sub-resource failure must not crash the
 * whole detail page, which already renders correctly around an empty URLs section (code-review
 * finding, `dashboard-web-page-inventory`: this previously threw on any non-404 non-OK status,
 * so a transient `page_urls` backend error would reject the `Promise.all` it's called from and
 * take down the entire page — title, status actions, every other section — not just this one).
 * The non-404 case is still logged, matching `fetchProjectApprovers()`'s own identical
 * degrade-but-log precedent for an optional/secondary fetch.
 */
export async function getPageUrls(projectId: string, pageId: string): Promise<readonly PageUrl[]> {
  if (!isUuid(projectId) || !isUuid(pageId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(
    `${apiBaseUrl}/page-inventory/projects/${projectId}/pages/${pageId}/urls`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    console.error(`Failed to load page URLs for page ${pageId} (status ${response.status})`);
    return [];
  }
  return ((await response.json()) as ApiSuccessResponse<readonly PageUrl[]>).data;
}
