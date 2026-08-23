import { cookies } from "next/headers";
import type { ApiSuccessResponse, WebsiteStrategyRecord } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import { isUuid } from "./uuid";
import {
  APPROVAL_STATUS_LABEL,
  buildWebsiteStrategyCenterHref,
  parseWebsiteStrategyCenterSearchParams,
  RECORD_TYPE_LABEL,
  RECORD_TYPE_VALUES,
  websiteStrategyApprovalStatusBadge,
  type WebsiteStrategyCenterQuery,
} from "./website-strategy-center-query";

export {
  APPROVAL_STATUS_LABEL,
  buildWebsiteStrategyCenterHref,
  formatTimestamp,
  parseWebsiteStrategyCenterSearchParams,
  RECORD_TYPE_LABEL,
  RECORD_TYPE_VALUES,
  websiteStrategyApprovalStatusBadge,
};
export type { WebsiteStrategyCenterQuery };

export interface WebsiteStrategyRecordListResult {
  readonly items: readonly WebsiteStrategyRecord[];
  /** Same "request one row past the chosen page size" technique `getServices()`/`getPersonas()`/
   *  `getProofClaims()` use — `GET /website-strategy-center/records` returns no total count to
   *  check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the record list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching every
 *  sibling module's own list-fetch precedent. */
export async function getWebsiteStrategyRecords(
  query: WebsiteStrategyCenterQuery,
): Promise<WebsiteStrategyRecordListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.recordType) params.set("recordType", query.recordType);
  if (query.approvalStatus) params.set("approvalStatus", query.approvalStatus);
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/website-strategy-center/records?${params.toString()}`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to load website strategy records (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly WebsiteStrategyRecord[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches the CURRENT version of one record, by its stable `recordId` — not the row `id` (which
 * changes across a version fork). Returns `null` on a 404 (the caller renders `notFound()`) or a
 * malformed id (rejected via `isUuid()` before any network call, the same short-circuit
 * `getPersona()`/`getService()`/`getProjectDetail()` use), and throws on any other non-OK status
 * (403/5xx).
 */
export async function getWebsiteStrategyRecord(
  recordId: string,
): Promise<WebsiteStrategyRecord | null> {
  if (!isUuid(recordId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/website-strategy-center/records/${recordId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load website strategy record (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<WebsiteStrategyRecord>).data;
}

/**
 * Fetches every version of one record, oldest first (the backend's own order — see
 * `WebsiteStrategyRecordRepository.listVersions()`), for the detail page's "Version history"
 * section. Returns an empty array rather than throwing on a malformed id (the same short-circuit
 * `getWebsiteStrategyRecord()` uses) or on a 404 — the detail page already gates its own rendering
 * on `getWebsiteStrategyRecord()`'s own `null`/`notFound()` result, so a genuinely-missing record
 * never reaches a point where this function's result matters; degrading here instead of throwing
 * just avoids a second, redundant not-found code path. Any other non-OK status still throws,
 * matching every other fetch function in this module.
 */
export async function getWebsiteStrategyRecordVersions(
  recordId: string,
): Promise<readonly WebsiteStrategyRecord[]> {
  if (!isUuid(recordId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(
    `${apiBaseUrl}/website-strategy-center/records/${recordId}/versions`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`Failed to load website strategy record versions (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly WebsiteStrategyRecord[]>).data;
}
