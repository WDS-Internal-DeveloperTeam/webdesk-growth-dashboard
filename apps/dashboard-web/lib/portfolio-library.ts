import { cookies } from "next/headers";
import type {
  ApiSuccessResponse,
  Asset,
  PortfolioAsset,
  PortfolioRecord,
  ProofClaim,
} from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { getAssets } from "./asset-library";
import { tolerateDiscard } from "./business-knowledge";
import { formatTimestamp } from "./format-timestamp";
import { getProofClaims } from "./proof-and-claims-library";
import {
  APPROVAL_STATUS_LABEL,
  buildPortfolioLibraryHref,
  parsePortfolioLibrarySearchParams,
  portfolioApprovalStatusBadge,
  portfolioPublishBadge,
  VISIBILITY_LABEL,
  VISIBILITY_VALUES,
  type PortfolioLibraryQuery,
} from "./portfolio-library-query";
import { isUuid } from "./uuid";

export {
  APPROVAL_STATUS_LABEL,
  buildPortfolioLibraryHref,
  formatTimestamp,
  parsePortfolioLibrarySearchParams,
  portfolioApprovalStatusBadge,
  portfolioPublishBadge,
  VISIBILITY_LABEL,
  VISIBILITY_VALUES,
};
export type { PortfolioLibraryQuery };

export interface PortfolioLibraryListResult {
  readonly items: readonly PortfolioRecord[];
  /** Same "request one row past the chosen page size" technique every sibling list fetch uses —
   *  `GET /portfolio-library/records` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the record list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  `getDesignReferenceRecords()`'s own precedent. */
export async function getPortfolioRecords(
  query: PortfolioLibraryQuery,
): Promise<PortfolioLibraryListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.approvalStatus) params.set("approvalStatus", query.approvalStatus);
  if (query.isPublished !== null) params.set("isPublished", String(query.isPublished));
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/portfolio-library/records?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load portfolio records (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly PortfolioRecord[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches one portfolio record. Returns `null` on a 404 (the caller renders `notFound()`) or a
 * malformed id (rejected via `isUuid()` before any network call, the same short-circuit every
 * sibling `get*()` uses), and throws on any other non-OK status (403/5xx).
 */
export async function getPortfolioRecord(recordId: string): Promise<PortfolioRecord | null> {
  if (!isUuid(recordId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/portfolio-library/records/${recordId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load portfolio record (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<PortfolioRecord>).data;
}

/** `GET /portfolio-library/records/:recordId/screenshots` — like Projects' own sub-resource
 *  endpoints, this doesn't itself validate the parent record's existence (a bogus `recordId`
 *  returns an empty array, not a 404), so it has no genuine data dependency on the primary record
 *  fetch and can run concurrently with it, mirroring `fetchCaseStudyAssets()`'s own reasoning. */
async function fetchPortfolioScreenshots(
  apiBaseUrl: string,
  recordId: string,
  headers: HeadersInit,
): Promise<readonly PortfolioAsset[]> {
  const response = await fetch(`${apiBaseUrl}/portfolio-library/records/${recordId}/screenshots`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load portfolio record screenshots (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly PortfolioAsset[]>).data;
}

export interface PortfolioDetailData {
  readonly record: PortfolioRecord;
  readonly screenshots: readonly PortfolioAsset[];
}

/**
 * Fetches a portfolio record and its owned `portfolio_assets` sub-resource for the detail page.
 * Returns `null` on a 404 from `GET /portfolio-library/records/:id` specifically (the caller
 * renders `notFound()`), and throws on any other non-OK status — same contract as
 * `getCaseStudyDetail()`. The screenshots fetch runs concurrently with the primary fetch, not
 * gated behind it (`tolerateDiscard()`), for the same reason `getCaseStudyDetail()`'s own
 * sub-resource fetches do — only the *decision* to keep the result waits on the primary fetch's
 * status.
 */
export async function getPortfolioDetail(recordId: string): Promise<PortfolioDetailData | null> {
  if (!isUuid(recordId)) {
    return null;
  }

  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const headers = { cookie: cookieHeader };

  const screenshotsPromise = tolerateDiscard(
    fetchPortfolioScreenshots(apiBaseUrl, recordId, headers),
  );

  const response = await fetch(`${apiBaseUrl}/portfolio-library/records/${recordId}`, {
    headers,
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load portfolio record (status ${response.status})`);
  }
  const record = ((await response.json()) as ApiSuccessResponse<PortfolioRecord>).data;

  const screenshots = await screenshotsPromise;
  return { record, screenshots };
}

/** Fetches proof claims to populate the `relatedProofIds` `RelationshipPicker`'s option set —
 *  reuses `getProofClaims()` (Proof and Claims Library's own list fetch) at the largest real
 *  `PageSize` option (100), matching `getProofClaimsForCaseStudyPicker()`'s own identical bound.
 *  Degrades to an empty list on failure rather than crashing the whole page — a transient outage
 *  in a different module shouldn't block viewing/editing this one. */
export async function getProofClaimsForPortfolioPicker(): Promise<readonly ProofClaim[]> {
  try {
    const { items } = await getProofClaims({
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 100,
    });
    return items;
  } catch (error) {
    console.error("Failed to load proof claims for the portfolio relationship picker:", error);
    return [];
  }
}

/** Same shape as `getProofClaimsForPortfolioPicker()` above, populating the `portfolio_assets`
 *  sub-resource section's asset-picker option set from Asset Library's own list fetch, mirroring
 *  `getAssetsForCaseStudyPicker()`'s own identical bound and failure-isolation. */
export async function getAssetsForPortfolioPicker(): Promise<readonly Asset[]> {
  try {
    const { items } = await getAssets({
      approvalStatus: null,
      visibility: null,
      scanStatus: null,
      isPublished: null,
      search: null,
      offset: 0,
      pageSize: 100,
    });
    return items;
  } catch (error) {
    console.error("Failed to load assets for the portfolio screenshot picker:", error);
    return [];
  }
}
