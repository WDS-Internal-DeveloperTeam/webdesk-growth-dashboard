import { cookies } from "next/headers";
import type { ApiSuccessResponse, Asset, AssetRelatedRecord } from "@webdesk/shared-types";
import {
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_VALUES,
  assetApprovalStatusBadge,
  assetPublishBadge,
  assetScanStatusBadge,
  assetVisibilityBadge,
  buildAssetLibraryHref,
  parseAssetLibrarySearchParams,
  SCAN_STATUS_LABEL,
  SCAN_STATUS_VALUES,
  VISIBILITY_LABEL,
  VISIBILITY_VALUES,
  type AssetLibraryQuery,
} from "./asset-library-query";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import { isUuid } from "./uuid";

export {
  APPROVAL_STATUS_LABEL,
  APPROVAL_STATUS_VALUES,
  assetApprovalStatusBadge,
  assetPublishBadge,
  assetScanStatusBadge,
  assetVisibilityBadge,
  buildAssetLibraryHref,
  formatTimestamp,
  parseAssetLibrarySearchParams,
  SCAN_STATUS_LABEL,
  SCAN_STATUS_VALUES,
  VISIBILITY_LABEL,
  VISIBILITY_VALUES,
};
export type { AssetLibraryQuery };

export interface AssetLibraryListResult {
  readonly items: readonly Asset[];
  /** Same "request one row past the chosen page size" technique `getBrandLibraryRecords()`/
   *  `getContentTemplates()` use — `GET /asset-library/assets` returns no total count to check
   *  against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the asset list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  `getBrandLibraryRecords()`'s own precedent. */
export async function getAssets(query: AssetLibraryQuery): Promise<AssetLibraryListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.approvalStatus) params.set("approvalStatus", query.approvalStatus);
  if (query.visibility) params.set("visibility", query.visibility);
  if (query.scanStatus) params.set("scanStatus", query.scanStatus);
  if (query.isPublished !== null) params.set("isPublished", String(query.isPublished));
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/asset-library/assets?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load assets (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly Asset[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches one asset. Returns `null` on a 404 (the caller renders `notFound()`) or a malformed id
 * (rejected via `isUuid()` before any network call, the same short-circuit
 * `getBrandLibraryRecord()`/`getContentTemplate()` use), and throws on any other non-OK status
 * (403/5xx).
 */
export async function getAsset(assetId: string): Promise<Asset | null> {
  if (!isUuid(assetId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/asset-library/assets/${assetId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load asset (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<Asset>).data;
}

/**
 * Fetches an asset's related-record links. Degrades to an empty array on any failure rather than
 * throwing — a related-records fetch failure must never crash the whole detail page, the same
 * failure-isolation precedent every sibling module's own sub-resource fetch already establishes
 * (e.g. `getUsersByIds()`'s `Promise.allSettled` degrade, `lib/business-knowledge-attachments.ts`).
 * Caller must already know `assetId` is a valid UUID (only called from the detail page after
 * `getAsset()` has already succeeded).
 */
export async function getAssetRelatedRecords(
  assetId: string,
): Promise<readonly AssetRelatedRecord[]> {
  try {
    const apiBaseUrl = getApiBaseUrl();
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const response = await fetch(`${apiBaseUrl}/asset-library/assets/${assetId}/related-records`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!response.ok) {
      return [];
    }
    return ((await response.json()) as ApiSuccessResponse<readonly AssetRelatedRecord[]>).data;
  } catch {
    return [];
  }
}
