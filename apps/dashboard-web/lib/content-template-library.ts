import { cookies } from "next/headers";
import type { ApiSuccessResponse, ContentTemplate } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import {
  APPROVAL_STATUS_LABEL,
  buildContentTemplateLibraryHref,
  contentTemplateApprovalStatusBadge,
  contentTemplatePublishBadge,
  parseContentTemplateLibrarySearchParams,
  type ContentTemplateLibraryQuery,
} from "./content-template-library-query";
import { formatTimestamp } from "./format-timestamp";
import { isUuid } from "./uuid";

export {
  APPROVAL_STATUS_LABEL,
  buildContentTemplateLibraryHref,
  contentTemplateApprovalStatusBadge,
  contentTemplatePublishBadge,
  formatTimestamp,
  parseContentTemplateLibrarySearchParams,
};
export type { ContentTemplateLibraryQuery };

export interface ContentTemplateListResult {
  readonly items: readonly ContentTemplate[];
  /** Same "request one row past the chosen page size" technique `getPersonas()`/`getServices()`
   *  use — `GET /content-template-library/templates` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the template list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  `getPersonas()`/`getServices()`'s own precedent. */
export async function getContentTemplates(
  query: ContentTemplateLibraryQuery,
): Promise<ContentTemplateListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.approvalStatus) params.set("approvalStatus", query.approvalStatus);
  if (query.isPublished !== null) params.set("isPublished", String(query.isPublished));
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/content-template-library/templates?${params.toString()}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load content templates (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly ContentTemplate[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches one content template. Returns `null` on a 404 (the caller renders `notFound()`) or a
 * malformed id (rejected via `isUuid()` before any network call, the same short-circuit
 * `getPersona()`/`getService()` use), and throws on any other non-OK status (403/5xx).
 */
export async function getContentTemplate(templateId: string): Promise<ContentTemplate | null> {
  if (!isUuid(templateId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/content-template-library/templates/${templateId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load content template (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<ContentTemplate>).data;
}
