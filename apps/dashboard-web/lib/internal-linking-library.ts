import { cookies } from "next/headers";
import type { ApiSuccessResponse, InternalLink, Page } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import {
  buildInternalLinkLibraryHref,
  internalLinkPriorityBadge,
  internalLinkStatusBadge,
  parseInternalLinkLibrarySearchParams,
  PRIORITY_LABEL,
  STATUS_LABEL,
  withProjectId,
  type InternalLinkLibraryQuery,
} from "./internal-linking-library-query";
import { getPages } from "./page-inventory";
import { isUuid } from "./uuid";

export {
  buildInternalLinkLibraryHref,
  formatTimestamp,
  internalLinkPriorityBadge,
  internalLinkStatusBadge,
  parseInternalLinkLibrarySearchParams,
  PRIORITY_LABEL,
  STATUS_LABEL,
  withProjectId,
};
export type { InternalLinkLibraryQuery };

/** Same "avoid an unhandled-rejection warning on a discarded promise" helper `getProjectDetail()`/
 *  `getPage()`'s own callers use — imported directly from `lib/business-knowledge.ts` at every
 *  call site in this module's routes, matching `lib/page-inventory.ts`'s own precedent of not
 *  re-exporting it locally. */
export { tolerateDiscard } from "./business-knowledge";

export interface InternalLinkListResult {
  readonly items: readonly InternalLink[];
  /** Same "request one row past the chosen page size" technique `getPages()`/`getKeywords()` use —
   *  `GET .../links` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the link list (once a project is
 *  selected), so a fetch failure must surface as a real error state (propagates to the nearest
 *  `error.tsx`), matching every sibling module's own list-fetch precedent. */
export async function getInternalLinks(
  query: InternalLinkLibraryQuery,
): Promise<InternalLinkListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.sourcePageId) params.set("sourcePageId", query.sourcePageId);
  if (query.targetPageId) params.set("targetPageId", query.targetPageId);
  if (query.status) params.set("status", query.status);
  if (query.priority) params.set("priority", query.priority);
  if (query.linkType) params.set("linkType", query.linkType);
  if (query.search) params.set("search", query.search);
  // One row past the chosen page size — see InternalLinkListResult.hasNextPage's own doc comment.
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/internal-linking-library/projects/${query.projectId}/links?${params.toString()}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load internal links (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly InternalLink[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches one internal link. Returns `null` on a 404 (the caller renders `notFound()`) or a
 * malformed `projectId`/`linkId` (rejected via `isUuid()` before any network call, the same
 * short-circuit `getPage()`/`getKeyword()`/`getProject()` use), and throws on any other non-OK
 * status (403/5xx).
 */
export async function getInternalLink(
  projectId: string,
  linkId: string,
): Promise<InternalLink | null> {
  if (!isUuid(projectId) || !isUuid(linkId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(
    `${apiBaseUrl}/internal-linking-library/projects/${projectId}/links/${linkId}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load internal link (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<InternalLink>).data;
}

/** Same bounded-top-100, degrade-on-failure pattern as `getPagesForKeywordPicker()`, reusing
 *  Page Inventory's own already-reviewed `getPages()` rather than a new fetch function — one
 *  function serves both the sourcePageId and targetPageId pickers on the create/edit form (either
 *  field can reference any page in the project, so both draw from the identical option pool). */
export async function getPagesForInternalLinkPicker(projectId: string): Promise<readonly Page[]> {
  try {
    const { items } = await getPages({
      projectId,
      pageType: null,
      workflowStage: null,
      indexStatus: null,
      template: null,
      search: null,
      targetKeyword: null,
      roadmapPhaseId: null,
      lastScanBefore: null,
      lastScanAfter: null,
      lastDeploymentBefore: null,
      lastDeploymentAfter: null,
      offset: 0,
      pageSize: 100,
    });
    return items;
  } catch (error) {
    console.error("Failed to load pages for the internal-link source/target pickers:", error);
    return [];
  }
}
