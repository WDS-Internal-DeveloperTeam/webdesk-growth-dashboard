import { cookies } from "next/headers";
import type { ApiSuccessResponse, ChangeRecord } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import {
  buildChangeCenterHref,
  CATEGORY_LABEL,
  changeRecordSeverityBadge,
  changeRecordStatusBadge,
  EDITABLE_STATUSES,
  moduleDisplayName,
  parseChangeCenterSearchParams,
  sortModulesForPicker,
  withProjectId,
  type ChangeCenterQuery,
} from "./change-center-query";
import { formatTimestamp } from "./format-timestamp";
import { isUuid } from "./uuid";

export {
  buildChangeCenterHref,
  CATEGORY_LABEL,
  changeRecordSeverityBadge,
  changeRecordStatusBadge,
  EDITABLE_STATUSES,
  formatTimestamp,
  moduleDisplayName,
  parseChangeCenterSearchParams,
  sortModulesForPicker,
  withProjectId,
};
export type { ChangeCenterQuery };

/** Same "avoid an unhandled-rejection warning on a discarded promise" helper `getProjectDetail()`/
 *  `getInternalLinks()`'s own callers use — imported directly from `lib/business-knowledge.ts` at
 *  every call site in this module's routes, matching `lib/internal-linking-library.ts`'s own
 *  precedent of not re-exporting it locally. */
export { tolerateDiscard } from "./business-knowledge";

export interface ChangeRecordListResult {
  readonly items: readonly ChangeRecord[];
  /** Same "request one row past the chosen page size" technique `getInternalLinks()`/`getPages()`
   *  use — `GET .../records` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the record list (once a project is
 *  selected), so a fetch failure must surface as a real error state (propagates to the nearest
 *  `error.tsx`), matching every sibling module's own list-fetch precedent. */
export async function getChangeRecords(query: ChangeCenterQuery): Promise<ChangeRecordListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.category) params.set("category", query.category);
  if (query.severity) params.set("severity", query.severity);
  if (query.status) params.set("status", query.status);
  if (query.scanFindingId) params.set("scanFindingId", query.scanFindingId);
  if (query.assignedToMe) params.set("assignedToMe", "true");
  if (query.search) params.set("search", query.search);
  // One row past the chosen page size — see ChangeRecordListResult.hasNextPage's own doc comment.
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/change-center/projects/${query.projectId}/records?${params.toString()}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load change records (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly ChangeRecord[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches one change record. Returns `null` on a 404 or a malformed `projectId`/`recordId`
 * (rejected via `isUuid()` before any network call, the same short-circuit `getInternalLink()`/
 * `getPage()` use), and throws on any other non-OK status (403/5xx).
 */
export async function getChangeRecord(
  projectId: string,
  recordId: string,
): Promise<ChangeRecord | null> {
  if (!isUuid(projectId) || !isUuid(recordId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(
    `${apiBaseUrl}/change-center/projects/${projectId}/records/${recordId}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load change record (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<ChangeRecord>).data;
}
