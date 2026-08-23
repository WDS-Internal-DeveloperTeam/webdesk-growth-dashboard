import { cookies } from "next/headers";
import type { ApiSuccessResponse, ClaimSource, ProofClaim, Service } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import {
  APPROVAL_STATUS_LABEL,
  buildProofAndClaimsLibraryHref,
  parseProofAndClaimsLibrarySearchParams,
  proofClaimApprovalStatusBadge,
  type ProofAndClaimsLibraryQuery,
} from "./proof-and-claims-library-query";
import { getServices } from "./service-library";
import { isUuid } from "./uuid";

export {
  APPROVAL_STATUS_LABEL,
  buildProofAndClaimsLibraryHref,
  formatTimestamp,
  parseProofAndClaimsLibrarySearchParams,
  proofClaimApprovalStatusBadge,
};
export type { ProofAndClaimsLibraryQuery };

export interface ProofClaimListResult {
  readonly items: readonly ProofClaim[];
  /** Same "request one row past the chosen page size" technique `getPersonas()`/`getServices()`/
   *  `getProjects()` use — `GET /proof-and-claims-library/claims` returns no total count to check
   *  against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the claim list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  `getPersonas()`/`getServices()`/`getProjects()`'s own precedent.
 *
 *  Known, accepted debt: this fetches (and `ProofClaim`'s type) the full row shape per list item,
 *  including several long-text fields the list page never renders — the identical over-fetch
 *  already flagged and accepted on `getPersonas()`/`getServices()`/`getBusinessKnowledgeRecords()`'s
 *  own list pages. A real fix needs a list-projection DTO on the backend, out of scope for a
 *  `dashboard-web`-only branch. */
export async function getProofClaims(
  query: ProofAndClaimsLibraryQuery,
): Promise<ProofClaimListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.approvalStatus) params.set("approvalStatus", query.approvalStatus);
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/proof-and-claims-library/claims?${params.toString()}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load proof claims (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly ProofClaim[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches one proof claim. Returns `null` on a 404 (the caller renders `notFound()`) or a
 * malformed id (rejected via `isUuid()` before any network call, the same short-circuit
 * `getService()`/`getPersona()`/`getProjectDetail()` use), and throws on any other non-OK status
 * (403/5xx).
 */
export async function getProofClaim(claimId: string): Promise<ProofClaim | null> {
  if (!isUuid(claimId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/proof-and-claims-library/claims/${claimId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load proof claim (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<ProofClaim>).data;
}

/**
 * A promise started for its side effect (an in-flight fetch) that may end up discarded without
 * ever being awaited — e.g. when `getProofClaimDetail()` below returns early on a 404 while the
 * sources fetch it fired concurrently is still in flight. Attaches a no-op catch so a discarded
 * rejection stays silent, while the original `promise` (returned unchanged) still rejects
 * normally for any caller that does await it — mirrors `lib/projects.ts`'s own `tolerateDiscard()`.
 */
function tolerateDiscard<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => {});
  return promise;
}

/** `GET /proof-and-claims-library/claims/:claimId/sources` — like Projects' own sub-resource
 *  endpoints, this doesn't itself validate the parent claim's existence (a bogus `claimId` returns
 *  an empty array, not a 404), so it has no genuine data dependency on the primary claim fetch and
 *  can run concurrently with it. */
async function fetchClaimSources(
  apiBaseUrl: string,
  claimId: string,
  headers: HeadersInit,
): Promise<readonly ClaimSource[]> {
  const response = await fetch(`${apiBaseUrl}/proof-and-claims-library/claims/${claimId}/sources`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load claim sources (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly ClaimSource[]>).data;
}

export interface ProofClaimDetailData {
  readonly claim: ProofClaim;
  readonly sources: readonly ClaimSource[];
}

/**
 * Fetches a proof claim and its owned `claim_sources` sub-resource for the detail page. Returns
 * `null` on a 404 from `GET /proof-and-claims-library/claims/:claimId` specifically (the caller
 * renders `notFound()`), and throws on any other non-OK status — same contract as
 * `getProjectDetail()`. The sources fetch runs concurrently with the primary fetch, not gated
 * behind it, for the same reason `getProjectDetail()`'s own sub-resource fetches do — only the
 * *decision* to keep the sources result waits on the primary fetch's status.
 */
export async function getProofClaimDetail(claimId: string): Promise<ProofClaimDetailData | null> {
  if (!isUuid(claimId)) {
    return null;
  }

  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const headers = { cookie: cookieHeader };

  const sourcesPromise = tolerateDiscard(fetchClaimSources(apiBaseUrl, claimId, headers));

  const response = await fetch(`${apiBaseUrl}/proof-and-claims-library/claims/${claimId}`, {
    headers,
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load proof claim (status ${response.status})`);
  }
  const claim = ((await response.json()) as ApiSuccessResponse<ProofClaim>).data;

  const sources = await sourcesPromise;
  return { claim, sources };
}

/**
 * Fetches services to populate the `relatedServiceIds` `RelationshipPicker`'s option set — reuses
 * `getServices()` (Service Library's own list fetch) rather than a new function, at the largest
 * real `PageSize` option (100), the identical bound `getServicesForPersonaPicker()` already
 * accepts. Degrades to an empty list on failure rather than throwing — this is enrichment for the
 * relationship picker, not the claim's own primary content, matching
 * `getServicesForPersonaPicker()`'s own precedent exactly.
 */
export async function getServicesForClaimPicker(): Promise<readonly Service[]> {
  try {
    const { items } = await getServices({
      categoryId: null,
      approvalStatus: null,
      publicationStatus: null,
      search: null,
      offset: 0,
      pageSize: 100,
    });
    return items;
  } catch (error) {
    console.error("Failed to load services for the proof claim relationship picker:", error);
    return [];
  }
}
