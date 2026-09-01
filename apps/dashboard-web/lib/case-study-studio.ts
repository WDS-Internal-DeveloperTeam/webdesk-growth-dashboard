import { cookies } from "next/headers";
import type {
  ApiSuccessResponse,
  Asset,
  CaseStudy,
  CaseStudyApproval,
  CaseStudyAsset,
  CaseStudyConsent,
  ProofClaim,
  Service,
} from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { tolerateDiscard } from "./business-knowledge";
import { formatTimestamp } from "./format-timestamp";
import {
  buildCaseStudyStudioHref,
  caseStudyStatusBadge,
  parseCaseStudyStudioSearchParams,
  type CaseStudyStudioQuery,
} from "./case-study-studio-query";
import { getAssets } from "./asset-library";
import { getProofClaims } from "./proof-and-claims-library";
import { getServices } from "./service-library";
import { isUuid } from "./uuid";

export {
  buildCaseStudyStudioHref,
  caseStudyStatusBadge,
  formatTimestamp,
  parseCaseStudyStudioSearchParams,
};
export type { CaseStudyStudioQuery };

export interface CaseStudyListResult {
  readonly items: readonly CaseStudy[];
  /** Same "request one row past the chosen page size" technique every sibling list fetch uses —
   *  `GET /case-study-studio/case-studies` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the case study list, so a fetch
 *  failure must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  `getProofClaims()`/`getPersonas()`/`getServices()`'s own precedent. */
export async function getCaseStudies(query: CaseStudyStudioQuery): Promise<CaseStudyListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/case-study-studio/case-studies?${params.toString()}`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to load case studies (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly CaseStudy[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches one case study. Returns `null` on a 404 (the caller renders `notFound()`) or a
 * malformed id (rejected via `isUuid()` before any network call, the same short-circuit every
 * sibling `get*()` uses), and throws on any other non-OK status (403/5xx).
 */
export async function getCaseStudy(caseStudyId: string): Promise<CaseStudy | null> {
  if (!isUuid(caseStudyId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/case-study-studio/case-studies/${caseStudyId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load case study (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<CaseStudy>).data;
}

/** `GET /case-study-studio/case-studies/:id/approvals` — a real sub-resource of an existing
 *  case study; a bogus id would already have 404'd via `getCaseStudy()` before this is ever
 *  called from the detail page, so this doesn't independently re-check existence. */
async function fetchCaseStudyApprovals(
  apiBaseUrl: string,
  caseStudyId: string,
  headers: HeadersInit,
): Promise<readonly CaseStudyApproval[]> {
  const response = await fetch(
    `${apiBaseUrl}/case-study-studio/case-studies/${caseStudyId}/approvals`,
    { headers, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load case study approvals (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly CaseStudyApproval[]>).data;
}

/** `GET /case-study-studio/case-studies/:caseStudyId/assets` — like Projects' own sub-resource
 *  endpoints, this doesn't itself validate the parent case study's existence (a bogus
 *  `caseStudyId` returns an empty array, not a 404), so it has no genuine data dependency on the
 *  primary case study fetch and can run concurrently with it. */
async function fetchCaseStudyAssets(
  apiBaseUrl: string,
  caseStudyId: string,
  headers: HeadersInit,
): Promise<readonly CaseStudyAsset[]> {
  const response = await fetch(
    `${apiBaseUrl}/case-study-studio/case-studies/${caseStudyId}/assets`,
    { headers, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load case study assets (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly CaseStudyAsset[]>).data;
}

/** `GET /case-study-studio/case-studies/:caseStudyId/consents` — same no-parent-existence-check
 *  shape as `fetchCaseStudyAssets()` above. */
async function fetchCaseStudyConsents(
  apiBaseUrl: string,
  caseStudyId: string,
  headers: HeadersInit,
): Promise<readonly CaseStudyConsent[]> {
  const response = await fetch(
    `${apiBaseUrl}/case-study-studio/case-studies/${caseStudyId}/consents`,
    { headers, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load case study consents (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly CaseStudyConsent[]>).data;
}

export interface CaseStudyDetailData {
  readonly caseStudy: CaseStudy;
  readonly assets: readonly CaseStudyAsset[];
  readonly consents: readonly CaseStudyConsent[];
  readonly approvals: readonly CaseStudyApproval[];
}

/**
 * Fetches a case study and its three owned sub-resources (assets/consents/approvals) for the
 * detail page. Returns `null` on a 404 from `GET /case-study-studio/case-studies/:id` specifically
 * (the caller renders `notFound()`), and throws on any other non-OK status — same contract as
 * `getProofClaimDetail()`. All three sub-resource fetches run concurrently with the primary fetch,
 * not gated behind it (`tolerateDiscard()`), for the same reason `getProofClaimDetail()`'s own
 * sources fetch does — only the *decision* to keep each result waits on the primary fetch's
 * status.
 */
export async function getCaseStudyDetail(caseStudyId: string): Promise<CaseStudyDetailData | null> {
  if (!isUuid(caseStudyId)) {
    return null;
  }

  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const headers = { cookie: cookieHeader };

  const assetsPromise = tolerateDiscard(fetchCaseStudyAssets(apiBaseUrl, caseStudyId, headers));
  const consentsPromise = tolerateDiscard(fetchCaseStudyConsents(apiBaseUrl, caseStudyId, headers));
  const approvalsPromise = tolerateDiscard(
    fetchCaseStudyApprovals(apiBaseUrl, caseStudyId, headers),
  );

  const response = await fetch(`${apiBaseUrl}/case-study-studio/case-studies/${caseStudyId}`, {
    headers,
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load case study (status ${response.status})`);
  }
  const caseStudy = ((await response.json()) as ApiSuccessResponse<CaseStudy>).data;

  const [assets, consents, approvals] = await Promise.all([
    assetsPromise,
    consentsPromise,
    approvalsPromise,
  ]);
  return { caseStudy, assets, consents, approvals };
}

/**
 * Fetches services to populate the `relatedServiceIds` `RelationshipPicker`'s option set — reuses
 * `getServices()` (Service Library's own list fetch) rather than a new function, at the largest
 * real `PageSize` option (100), matching `getServicesForClaimPicker()`'s/
 * `getServicesForPersonaPicker()`'s own identical bound. Degrades to an empty list on failure
 * rather than throwing — this is enrichment for the relationship picker, not the case study's own
 * primary content.
 */
export async function getServicesForCaseStudyPicker(): Promise<readonly Service[]> {
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
    console.error("Failed to load services for the case study relationship picker:", error);
    return [];
  }
}

/** Same shape as `getServicesForCaseStudyPicker()`, populating the `relatedClaimIds`
 *  `RelationshipPicker`'s option set from Proof and Claims Library's own list fetch. */
export async function getProofClaimsForCaseStudyPicker(): Promise<readonly ProofClaim[]> {
  try {
    const { items } = await getProofClaims({
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 100,
    });
    return items;
  } catch (error) {
    console.error("Failed to load proof claims for the case study relationship picker:", error);
    return [];
  }
}

/** Same shape as `getServicesForCaseStudyPicker()`, populating the `case_study_assets` sub-resource
 *  section's asset-picker option set from Asset Library's own list fetch. */
export async function getAssetsForCaseStudyPicker(): Promise<readonly Asset[]> {
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
    console.error("Failed to load assets for the case study asset picker:", error);
    return [];
  }
}
