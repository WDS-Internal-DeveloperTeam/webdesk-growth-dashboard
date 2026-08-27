import { cookies } from "next/headers";
import type { ApiSuccessResponse, DesignReferenceRecord } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import {
  APPROVAL_STATUS_LABEL,
  buildDesignReferenceLibraryHref,
  designReferenceApprovalStatusBadge,
  designReferencePublishBadge,
  parseDesignReferenceLibrarySearchParams,
  type DesignReferenceLibraryQuery,
} from "./design-reference-library-query";
import { formatTimestamp } from "./format-timestamp";
import { isUuid } from "./uuid";

export {
  APPROVAL_STATUS_LABEL,
  buildDesignReferenceLibraryHref,
  designReferenceApprovalStatusBadge,
  designReferencePublishBadge,
  formatTimestamp,
  parseDesignReferenceLibrarySearchParams,
};
export type { DesignReferenceLibraryQuery };

export interface DesignReferenceLibraryListResult {
  readonly items: readonly DesignReferenceRecord[];
  /** Same "request one row past the chosen page size" technique `getBrandLibraryRecords()`/
   *  `getContentTemplates()`/`getPersonas()`/`getServices()` use —
   *  `GET /design-reference-library/records` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the record list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  `getBrandLibraryRecords()`'s own precedent. */
export async function getDesignReferenceRecords(
  query: DesignReferenceLibraryQuery,
): Promise<DesignReferenceLibraryListResult> {
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
    `${apiBaseUrl}/design-reference-library/records?${params.toString()}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load design reference records (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly DesignReferenceRecord[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches one design reference record. Returns `null` on a 404 (the caller renders `notFound()`)
 * or a malformed id (rejected via `isUuid()` before any network call, the same short-circuit
 * `getBrandLibraryRecord()`/`getContentTemplate()`/`getPersona()`/`getService()` use), and throws on
 * any other non-OK status (403/5xx).
 */
export async function getDesignReferenceRecord(
  recordId: string,
): Promise<DesignReferenceRecord | null> {
  if (!isUuid(recordId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/design-reference-library/records/${recordId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load design reference record (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<DesignReferenceRecord>).data;
}
