import { cookies } from "next/headers";
import type { ApiSuccessResponse, SectionPatternRecord } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import {
  APPROVAL_STATUS_LABEL,
  buildSectionAndPatternLibraryHref,
  PATTERN_TYPE_LABEL,
  PATTERN_TYPE_VALUES,
  parseSectionAndPatternLibrarySearchParams,
  sectionPatternApprovalStatusBadge,
  type SectionAndPatternLibraryQuery,
} from "./section-and-pattern-library-query";
import { isUuid } from "./uuid";

export {
  APPROVAL_STATUS_LABEL,
  buildSectionAndPatternLibraryHref,
  formatTimestamp,
  PATTERN_TYPE_LABEL,
  PATTERN_TYPE_VALUES,
  parseSectionAndPatternLibrarySearchParams,
  sectionPatternApprovalStatusBadge,
};
export type { SectionAndPatternLibraryQuery };

export interface SectionPatternListResult {
  readonly items: readonly SectionPatternRecord[];
  /** Same "request one row past the chosen page size" technique `getDesignTokens()`/
   *  `getWebsiteStrategyRecords()`/`getServices()`/`getPersonas()` use —
   *  `GET /section-and-pattern-library/records` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the record list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching every
 *  sibling module's own list-fetch precedent. */
export async function getSectionPatterns(
  query: SectionAndPatternLibraryQuery,
): Promise<SectionPatternListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.patternType) params.set("patternType", query.patternType);
  if (query.approvalStatus) params.set("approvalStatus", query.approvalStatus);
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/section-and-pattern-library/records?${params.toString()}`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to load section/pattern records (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly SectionPatternRecord[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches the CURRENT version of one section/pattern record, by its stable `recordId` — not the
 * row `id` (which changes across a version fork). Returns `null` on a 404 (the caller renders
 * `notFound()`) or a malformed id (rejected via `isUuid()` before any network call, the same
 * short-circuit `getDesignToken()`/`getWebsiteStrategyRecord()`/`getPersona()`/`getService()`
 * use), and throws on any other non-OK status (403/5xx).
 */
export async function getSectionPattern(recordId: string): Promise<SectionPatternRecord | null> {
  if (!isUuid(recordId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/section-and-pattern-library/records/${recordId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load section/pattern record (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<SectionPatternRecord>).data;
}

/**
 * Fetches every version of one section/pattern record, oldest first (the backend's own order —
 * see `SectionPatternRecordRepository.listVersions()`), for the detail page's "Version history"
 * section. Returns an empty array rather than throwing on a malformed id (the same short-circuit
 * `getSectionPattern()` uses) or on a 404 — the detail page already gates its own rendering on
 * `getSectionPattern()`'s own `null`/`notFound()` result, so a genuinely-missing record never
 * reaches a point where this function's result matters; degrading here instead of throwing just
 * avoids a second, redundant not-found code path. Any other non-OK status still throws, matching
 * every other fetch function in this module.
 */
export async function getSectionPatternVersions(
  recordId: string,
): Promise<readonly SectionPatternRecord[]> {
  if (!isUuid(recordId)) {
    return [];
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(
    `${apiBaseUrl}/section-and-pattern-library/records/${recordId}/versions`,
    {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    },
  );
  if (response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error(`Failed to load section/pattern record versions (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly SectionPatternRecord[]>).data;
}
