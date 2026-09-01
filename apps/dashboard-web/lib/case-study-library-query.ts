import type { CaseStudyStatus } from "@webdesk/shared-types";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `CaseStudyLibraryQuery`/`parseCaseStudyLibrarySearchParams`/`buildCaseStudyLibraryHref` live in
 * their own file with zero non-type imports, rather than in `lib/case-study-library.ts` where the
 * server-side fetch functions live — so a `"use client"` component (the create/edit form) can
 * import them directly without pulling in `lib/case-study-library.ts`'s `next/headers` import.
 * Same precedent as `lib/case-study-studio-query.ts`/`lib/persona-library-query.ts`.
 *
 * The record itself has no `status`/lifecycle of its own (D1) — `GET /case-study-library/records`
 * only ever accepts `search`/`limit`/`offset`, so this query has no status filter, unlike every
 * sibling module's own query shape.
 */

/** D5 — a library record may only be created for a parent case study whose own `status` has
 *  reached one of these, mirroring `CASE_STUDY_LIBRARY_RECORD.md`'s (this module's own service)
 *  `CREATABLE_FROM_STATUSES`. Used to filter the create-form's case study picker to eligible
 *  parents — the backend is still the real, authoritative enforcement point. */
export const CREATABLE_FROM_STATUSES: readonly CaseStudyStatus[] = [
  "published",
  "unpublished",
  "archived",
];

export interface CaseStudyLibraryQuery {
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — clamped to the same 255-char max
 * `listCaseStudyLibraryRecordsQuerySchema` itself enforces, matching every sibling list page's
 * own defense-in-depth precedent, rather than passed through raw.
 */
export function parseCaseStudyLibrarySearchParams(
  raw: Record<string, string | string[] | undefined>,
): CaseStudyLibraryQuery {
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/case-study-library?...` href — `overrides` wins over `current`, and changing
 * anything other than `offset` itself resets `offset` to 0, same convention as every sibling
 * module's own `build*Href`.
 */
export function buildCaseStudyLibraryHref(
  current: CaseStudyLibraryQuery,
  overrides: Partial<CaseStudyLibraryQuery>,
): string {
  const next: CaseStudyLibraryQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/case-study-library?${queryString}` : "/case-study-library";
}
