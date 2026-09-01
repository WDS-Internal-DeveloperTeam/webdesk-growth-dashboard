import { cookies } from "next/headers";
import type {
  ApiSuccessResponse,
  CaseStudy,
  CaseStudyLibraryRecordWithCaseStudy,
} from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { getCaseStudies } from "./case-study-studio";
import {
  buildCaseStudyLibraryHref,
  CREATABLE_FROM_STATUSES,
  parseCaseStudyLibrarySearchParams,
  type CaseStudyLibraryQuery,
} from "./case-study-library-query";
import { formatTimestamp } from "./format-timestamp";
import { isUuid } from "./uuid";

export { buildCaseStudyLibraryHref, formatTimestamp, parseCaseStudyLibrarySearchParams };
export type { CaseStudyLibraryQuery };

export interface CaseStudyLibraryListResult {
  readonly items: readonly CaseStudyLibraryRecordWithCaseStudy[];
  /** Same "request one row past the chosen page size" technique every sibling list fetch uses —
   *  `GET /case-study-library/records` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the record list, so a fetch failure
 *  must surface as a real error state (propagates to the nearest `error.tsx`), matching every
 *  sibling module's own list-fetch precedent. */
export async function getCaseStudyLibraryRecords(
  query: CaseStudyLibraryQuery,
): Promise<CaseStudyLibraryListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/case-study-library/records?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load case study library records (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<
    readonly CaseStudyLibraryRecordWithCaseStudy[]
  >;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/**
 * Fetches one library record, joined with its parent case study. Returns `null` on a 404 (the
 * caller renders `notFound()`) or a malformed id (rejected via `isUuid()` before any network
 * call, the same short-circuit every sibling `get*()` uses), and throws on any other non-OK
 * status (403/5xx).
 */
export async function getCaseStudyLibraryRecord(
  recordId: string,
): Promise<CaseStudyLibraryRecordWithCaseStudy | null> {
  if (!isUuid(recordId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/case-study-library/records/${recordId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load case study library record (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<CaseStudyLibraryRecordWithCaseStudy>).data;
}

/**
 * Fetches case studies to populate the create form's parent-case-study `SingleCaseStudyPicker` —
 * reuses `getCaseStudies()` (Case Study Studio's own list fetch) rather than a new function, at
 * the largest real `PageSize` option (100), matching `getServicesForCaseStudyPicker()`'s own
 * identical bound. Filtered to D5's `CREATABLE_FROM_STATUSES` client-side (the backend is still
 * the real, authoritative enforcement point) so the picker doesn't offer a case study the create
 * call would just reject. Degrades to an empty list on failure rather than throwing — this is
 * enrichment for the relationship picker, not the record's own primary content. Does NOT exclude
 * a case study that already has a library record (no cheap existence check exists for that here);
 * picking one just surfaces the backend's own real 409, a known, accepted limitation.
 */
export async function getCaseStudiesForLibraryPicker(): Promise<readonly CaseStudy[]> {
  try {
    const { items } = await getCaseStudies({
      status: null,
      search: null,
      offset: 0,
      pageSize: 100,
    });
    return items.filter((caseStudy) => CREATABLE_FROM_STATUSES.includes(caseStudy.status));
  } catch (error) {
    console.error("Failed to load case studies for the library record picker:", error);
    return [];
  }
}
