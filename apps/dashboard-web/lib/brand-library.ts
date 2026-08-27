import { cookies } from "next/headers";
import type { ApiSuccessResponse, BrandLibraryRecord } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import {
  APPROVAL_STATUS_LABEL,
  brandLibraryApprovalStatusBadge,
  brandLibraryPublishBadge,
  buildBrandLibraryHref,
  parseBrandLibrarySearchParams,
  RECORD_TYPE_LABEL,
  RECORD_TYPE_VALUES,
  type BrandLibraryQuery,
} from "./brand-library-query";
import { formatTimestamp } from "./format-timestamp";
import { isUuid } from "./uuid";

export {
  APPROVAL_STATUS_LABEL,
  brandLibraryApprovalStatusBadge,
  brandLibraryPublishBadge,
  buildBrandLibraryHref,
  formatTimestamp,
  parseBrandLibrarySearchParams,
  RECORD_TYPE_LABEL,
  RECORD_TYPE_VALUES,
};
export type { BrandLibraryQuery };

export interface BrandLibraryListResult {
  readonly items: readonly BrandLibraryRecord[];
  /** Same "request one row past the chosen page size" technique `getContentTemplates()`/
   *  `getPersonas()`/`getServices()` use — `GET /brand-library/records` returns no total count to
   *  check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the record list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  `getContentTemplates()`'s own precedent. */
export async function getBrandLibraryRecords(
  query: BrandLibraryQuery,
): Promise<BrandLibraryListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.recordType) params.set("recordType", query.recordType);
  if (query.approvalStatus) params.set("approvalStatus", query.approvalStatus);
  if (query.isPublished !== null) params.set("isPublished", String(query.isPublished));
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/brand-library/records?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load brand library records (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly BrandLibraryRecord[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches one brand library record. Returns `null` on a 404 (the caller renders `notFound()`) or a
 * malformed id (rejected via `isUuid()` before any network call, the same short-circuit
 * `getContentTemplate()`/`getPersona()`/`getService()` use), and throws on any other non-OK status
 * (403/5xx).
 */
export async function getBrandLibraryRecord(recordId: string): Promise<BrandLibraryRecord | null> {
  if (!isUuid(recordId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/brand-library/records/${recordId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load brand library record (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<BrandLibraryRecord>).data;
}
