import { cookies } from "next/headers";
import type { ApiSuccessResponse, WireframeRecord } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import { isUuid } from "./uuid";
import {
  APPROVAL_STATUS_LABEL,
  buildWireframeLibraryHref,
  VIEWPORT_LABEL,
  VIEWPORT_VALUES,
  parseWireframeLibrarySearchParams,
  wireframeApprovalStatusBadge,
  type WireframeLibraryQuery,
} from "./wireframe-library-query";

export {
  APPROVAL_STATUS_LABEL,
  buildWireframeLibraryHref,
  formatTimestamp,
  VIEWPORT_LABEL,
  VIEWPORT_VALUES,
  parseWireframeLibrarySearchParams,
  wireframeApprovalStatusBadge,
};
export type { WireframeLibraryQuery };

export interface WireframeListResult {
  readonly items: readonly WireframeRecord[];
  /** Same "request one row past the chosen page size" technique `getSectionPatterns()`/
   *  `getPageTemplates()`/`getServices()`/`getPersonas()` use — `GET /wireframe-library/records`
   *  returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the record list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching every
 *  sibling module's own list-fetch precedent. */
export async function getWireframes(query: WireframeLibraryQuery): Promise<WireframeListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.viewport) params.set("viewport", query.viewport);
  if (query.approvalStatus) params.set("approvalStatus", query.approvalStatus);
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/wireframe-library/records?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load wireframe records (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly WireframeRecord[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches the CURRENT version of one wireframe record, by its stable `recordId` — not the row
 * `id` (which changes across a version fork). Returns `null` on a 404 (the caller renders
 * `notFound()`) or a malformed id (rejected via `isUuid()` before any network call, the same
 * short-circuit `getSectionPattern()`/`getPageTemplate()` use), and throws on any other non-OK
 * status (403/5xx).
 */
export async function getWireframe(recordId: string): Promise<WireframeRecord | null> {
  if (!isUuid(recordId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/wireframe-library/records/${recordId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load wireframe record (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<WireframeRecord>).data;
}

/**
 * Fetches every version of one wireframe record, oldest first (the backend's own order — see
 * `WireframeRecordRepository.listVersions()`), for the detail page's "Version history" section.
 * Returns an empty array rather than throwing on a malformed id (the same short-circuit
 * `getWireframe()` uses) or on a 404 — the detail page already gates its own rendering on
 * `getWireframe()`'s own `null`/`notFound()` result, so a genuinely-missing record never reaches a
 * point where this function's result matters; degrading here instead of throwing just avoids a
 * second, redundant not-found code path. Any other non-OK status still throws, matching every
 * other fetch function in this module.
 */
export async function getWireframeVersions(recordId: string): Promise<readonly WireframeRecord[]> {
  if (!isUuid(recordId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/wireframe-library/records/${recordId}/versions`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`Failed to load wireframe record versions (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly WireframeRecord[]>).data;
}
