/**
 * Shared page-size vocabulary for every paginated list page (`/projects`,
 * `/business-knowledge-center`) — one place for the allowed values and the "validate an untrusted
 * `searchParams` value against them" logic, rather than each list page's own query-parsing file
 * repeating an identical literal array and `includes()` check. Zero non-type imports, so a
 * `"use client"` component (the page-size select) can import it directly — same precedent as
 * `lib/search-params.ts`.
 */

export const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100] as const;

export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export const DEFAULT_PAGE_SIZE: PageSize = 20;

/** Rejects anything not exactly one of `PAGE_SIZE_OPTIONS` (a hand-edited URL, a stale bookmark
 *  from before this option list changed) rather than passing an arbitrary number through to the
 *  backend's own `limit` param. */
export function parsePageSize(raw: string | undefined): PageSize {
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return (PAGE_SIZE_OPTIONS as readonly number[]).includes(parsed)
    ? (parsed as PageSize)
    : DEFAULT_PAGE_SIZE;
}
