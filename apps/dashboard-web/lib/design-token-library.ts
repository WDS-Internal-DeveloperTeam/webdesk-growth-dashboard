import { cookies } from "next/headers";
import type { ApiSuccessResponse, DesignTokenRecord } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import {
  APPROVAL_STATUS_LABEL,
  buildDesignTokenLibraryHref,
  designTokenApprovalStatusBadge,
  GROUP_LABEL,
  GROUP_VALUES,
  parseDesignTokenLibrarySearchParams,
  THEME_VARIATION_LABEL,
  THEME_VARIATION_VALUES,
  type DesignTokenLibraryQuery,
} from "./design-token-library-query";
import { formatTimestamp } from "./format-timestamp";
import { isUuid } from "./uuid";

export {
  APPROVAL_STATUS_LABEL,
  buildDesignTokenLibraryHref,
  designTokenApprovalStatusBadge,
  formatTimestamp,
  GROUP_LABEL,
  GROUP_VALUES,
  parseDesignTokenLibrarySearchParams,
  THEME_VARIATION_LABEL,
  THEME_VARIATION_VALUES,
};
export type { DesignTokenLibraryQuery };

export interface DesignTokenListResult {
  readonly items: readonly DesignTokenRecord[];
  /** Same "request one row past the chosen page size" technique `getWebsiteStrategyRecords()`/
   *  `getServices()`/`getPersonas()` use — `GET /design-token-library/tokens` returns no total
   *  count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the token list, so a fetch failure must
 *  surface as a real error state (propagates to the nearest `error.tsx`), matching every sibling
 *  module's own list-fetch precedent. */
export async function getDesignTokens(
  query: DesignTokenLibraryQuery,
): Promise<DesignTokenListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.group) params.set("group", query.group);
  if (query.approvalStatus) params.set("approvalStatus", query.approvalStatus);
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/design-token-library/tokens?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load design tokens (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly DesignTokenRecord[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches the CURRENT version of one token record, by its stable `recordId` — not the row `id`
 * (which changes across a version fork). Returns `null` on a 404 (the caller renders `notFound()`)
 * or a malformed id (rejected via `isUuid()` before any network call, the same short-circuit
 * `getWebsiteStrategyRecord()`/`getPersona()`/`getService()` use), and throws on any other non-OK
 * status (403/5xx).
 */
export async function getDesignToken(recordId: string): Promise<DesignTokenRecord | null> {
  if (!isUuid(recordId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/design-token-library/tokens/${recordId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load design token (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<DesignTokenRecord>).data;
}

/**
 * Fetches every version of one token record, oldest first (the backend's own order — see
 * `DesignTokenRepository.listVersions()`), for the detail page's "Version history" section.
 * Returns an empty array rather than throwing on a malformed id (the same short-circuit
 * `getDesignToken()` uses) or on a 404 — the detail page already gates its own rendering on
 * `getDesignToken()`'s own `null`/`notFound()` result, so a genuinely-missing record never reaches
 * a point where this function's result matters; degrading here instead of throwing just avoids a
 * second, redundant not-found code path. Any other non-OK status still throws, matching every
 * other fetch function in this module.
 */
export async function getDesignTokenVersions(
  recordId: string,
): Promise<readonly DesignTokenRecord[]> {
  if (!isUuid(recordId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/design-token-library/tokens/${recordId}/versions`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`Failed to load design token versions (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly DesignTokenRecord[]>).data;
}
