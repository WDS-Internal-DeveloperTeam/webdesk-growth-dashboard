import { cookies } from "next/headers";
import type { ApiSuccessResponse, InternalLink, Page, UserSummary } from "@webdesk/shared-types";
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
import { getPage, getPages } from "./page-inventory";
import { isUuid } from "./uuid";
import { getUser } from "./users";

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

export interface ResolvedLinkRelationships {
  readonly sourcePage: Page | null;
  readonly targetPage: Page | null;
  readonly approver: UserSummary | null;
}

/**
 * Resolves a link's `sourcePageId`/`targetPageId`/`assignedApproverUserId` to display data —
 * shared by the detail and edit pages (previously a byte-for-byte duplicated inline block in
 * both). Each of the three lookups is independently guarded: `getUser()`/`getPage()` both throw
 * on any non-404 non-OK status (e.g. a 403), and `GET /users/:userId` is gated on `users_roles:view`,
 * a grant only 2 of the 7 seeded roles hold — every other role viewing a link with an assigned
 * approver would otherwise crash the whole page. These are secondary, non-essential lookups (the
 * page's primary content — the link itself — doesn't depend on them), so a failure degrades to
 * `null` (rendered as "could not be resolved"/the raw id) rather than crashing via the error
 * boundary, mirroring `apps/dashboard-web/app/(shell)/projects/[projectId]/edit/page.tsx`'s own
 * identical `getUser()` guard.
 *
 * `pagePool` (optional) is an already-fetched page list — the edit page already fetches
 * `getPagesForInternalLinkPicker()` for its own pickers, and `sourcePageId`/`targetPageId` were
 * originally chosen from that identical pool, so a local lookup resolves the common case with no
 * extra network round trip; `getPage()` only fires on a genuine miss (a page outside the picker's
 * bounded top-100 window). The detail page has no such pool and always calls `getPage()` directly.
 */
export async function resolveLinkRelationships(
  projectId: string,
  link: InternalLink,
  pagePool?: readonly Page[],
): Promise<ResolvedLinkRelationships> {
  const findInPool = (pageId: string): Page | undefined => pagePool?.find((p) => p.id === pageId);

  const resolvePage = async (pageId: string, label: string): Promise<Page | null> => {
    const fromPool = findInPool(pageId);
    if (fromPool) {
      return fromPool;
    }
    try {
      return await getPage(projectId, pageId);
    } catch (error) {
      console.error(`Failed to resolve internal link ${label} page`, error);
      return null;
    }
  };

  const [sourcePage, targetPage, approver] = await Promise.all([
    resolvePage(link.sourcePageId, "source"),
    resolvePage(link.targetPageId, "target"),
    link.assignedApproverUserId
      ? getUser(link.assignedApproverUserId).catch((error: unknown) => {
          console.error("Failed to resolve internal link approver", error);
          return null;
        })
      : Promise.resolve(null),
  ]);
  return { sourcePage, targetPage, approver };
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
