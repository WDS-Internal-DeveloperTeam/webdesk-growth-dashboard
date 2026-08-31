import { cookies } from "next/headers";
import type { ApiSuccessResponse, ComponentRecord, DesignTokenRecord } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import {
  APPROVAL_STATUS_LABEL,
  buildComponentLibraryHref,
  componentApprovalStatusBadge,
  parseComponentLibrarySearchParams,
  type ComponentLibraryQuery,
} from "./component-library-query";
import { getDesignTokens } from "./design-token-library";
import { formatTimestamp } from "./format-timestamp";
import { isUuid } from "./uuid";

export {
  APPROVAL_STATUS_LABEL,
  buildComponentLibraryHref,
  componentApprovalStatusBadge,
  formatTimestamp,
  parseComponentLibrarySearchParams,
};
export type { ComponentLibraryQuery };

export interface ComponentListResult {
  readonly items: readonly ComponentRecord[];
  /** Same "request one row past the chosen page size" technique `getDesignTokens()`/
   *  `getWebsiteStrategyRecords()`/`getServices()`/`getPersonas()` use —
   *  `GET /component-library/components` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the component list, so a fetch
 *  failure must surface as a real error state (propagates to the nearest `error.tsx`), matching
 *  every sibling module's own list-fetch precedent. */
export async function getComponents(query: ComponentLibraryQuery): Promise<ComponentListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.category) params.set("category", query.category);
  if (query.approvalStatus) params.set("approvalStatus", query.approvalStatus);
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/component-library/components?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load components (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly ComponentRecord[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches the CURRENT version of one component record, by its stable `recordId` — not the row
 * `id` (which changes across a version fork). Returns `null` on a 404 (the caller renders
 * `notFound()`) or a malformed id (rejected via `isUuid()` before any network call, the same
 * short-circuit `getDesignToken()`/`getWebsiteStrategyRecord()`/`getPersona()`/`getService()` use),
 * and throws on any other non-OK status (403/5xx).
 */
export async function getComponent(recordId: string): Promise<ComponentRecord | null> {
  if (!isUuid(recordId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/component-library/components/${recordId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load component (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<ComponentRecord>).data;
}

/**
 * Fetches every version of one component record, oldest first (the backend's own order — see
 * `ComponentRepository.listVersions()`), for the detail page's "Version history" section. Returns
 * an empty array rather than throwing on a malformed id (the same short-circuit `getComponent()`
 * uses) or on a 404 — the detail page already gates its own rendering on `getComponent()`'s own
 * `null`/`notFound()` result, so a genuinely-missing record never reaches a point where this
 * function's result matters; degrading here instead of throwing just avoids a second, redundant
 * not-found code path. Any other non-OK status still throws, matching every other fetch function
 * in this module.
 */
export async function getComponentVersions(recordId: string): Promise<readonly ComponentRecord[]> {
  if (!isUuid(recordId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/component-library/components/${recordId}/versions`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`Failed to load component versions (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly ComponentRecord[]>).data;
}

/**
 * Fetches design tokens to populate the `tokenIds` `RelationshipPicker`'s option set — reuses
 * `getDesignTokens()` (Design Token Library's own list fetch) rather than a new function, at the
 * largest real `PageSize` option (100), mirroring `getServicesForPersonaPicker()`'s own precedent.
 * The backend's own list cap is 200 (`MAX_LIST_LIMIT`), so a catalog larger than 100 rows silently
 * shows only its first page here — the identical bound every dimension-list-backed picker in this
 * app already accepts, not fixed in this pass.
 *
 * Degrades to an empty list on failure rather than throwing (mirrors `getServicesForPersonaPicker()`'s
 * own reasoning) — this is enrichment for the relationship picker, not the component's own primary
 * content, and every caller runs it alongside `getComponent()`/renders it on its own page. Without
 * this, a transient Design Token Library outage would crash the entire detail/edit/new component
 * page even when the component itself loaded fine. The one real cost is a silently-empty picker on
 * failure, logged here so it's diagnosable server-side rather than invisible.
 */
export async function getDesignTokensForComponentPicker(): Promise<readonly DesignTokenRecord[]> {
  try {
    const { items } = await getDesignTokens({
      group: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 100,
    });
    return items;
  } catch (error) {
    console.error("Failed to load design tokens for the component relationship picker:", error);
    return [];
  }
}

/**
 * Fetches components to populate the `replacementRecordId` `SingleComponentPicker`'s option set —
 * reuses `getComponents()` (this module's own list fetch) at the largest real `PageSize` option
 * (100), mirroring `getDesignTokensForComponentPicker()`'s own reasoning immediately above. Unlike
 * that cross-module fetch, this is an IN-module self-reference — a component picking which OTHER
 * component (by `recordId`) replaces it — so the currently-edited record is excluded client-side
 * by the picker itself (`SingleComponentPicker`'s own `excludeRecordId` prop), not here.
 *
 * Degrades to an empty list on failure rather than throwing, same reasoning as
 * `getDesignTokensForComponentPicker()` — a transient failure here must not crash the whole
 * detail/edit/new page.
 */
export async function getComponentsForReplacementPicker(): Promise<readonly ComponentRecord[]> {
  try {
    const { items } = await getComponents({
      category: null,
      approvalStatus: null,
      search: null,
      offset: 0,
      pageSize: 100,
    });
    return items;
  } catch (error) {
    console.error("Failed to load components for the replacement-component picker:", error);
    return [];
  }
}
