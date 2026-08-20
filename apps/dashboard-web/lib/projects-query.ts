/**
 * `PROJECTS_PAGE_SIZE`/`ProjectStatusFilter`/`ProjectSortBy`/`ProjectSortOrder`/`ProjectsQuery`/
 * `parseProjectsSearchParams`/`buildProjectsHref` live in their own file with zero non-type
 * imports, rather than in `lib/projects.ts` where they originated, so a `"use client"` component
 * can import them directly without pulling in `lib/projects.ts`'s `next/headers` import — a value
 * import of anything from that module drags in the whole module, and `next/headers` is
 * Server-Component-only, so Next.js fails the client bundle otherwise. Same precedent as
 * `lib/format-timestamp.ts`/`lib/status-badges.ts`/`lib/safe-http-url.ts` — extracted proactively
 * here (code-review finding, `dashboard-web-subresource-editing`) rather than reactively the next
 * time a client component happens to need one of these, since `lib/projects.ts` has now hit this
 * exact `next build` failure twice already. `lib/projects.ts` re-exports everything here, so every
 * existing server-side call site is unaffected.
 */

export const PROJECTS_PAGE_SIZE = 25;

const STATUS_VALUES = ["active", "paused", "archived"] as const;
const SORT_BY_VALUES = ["name", "status", "createdAt", "updatedAt"] as const;
const SORT_ORDER_VALUES = ["ASC", "DESC"] as const;

export type ProjectStatusFilter = (typeof STATUS_VALUES)[number];
export type ProjectSortBy = (typeof SORT_BY_VALUES)[number];
export type ProjectSortOrder = (typeof SORT_ORDER_VALUES)[number];

export interface ProjectsQuery {
  readonly search: string | null;
  readonly status: ProjectStatusFilter | null;
  readonly sortBy: ProjectSortBy;
  readonly sortOrder: ProjectSortOrder;
  readonly offset: number;
}

const DEFAULT_QUERY: ProjectsQuery = {
  search: null,
  status: null,
  sortBy: "updatedAt",
  sortOrder: "DESC",
  offset: 0,
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Next.js `searchParams` is untrusted client input (a reader can type anything into the URL) —
 * every field is validated against the same enums `GET /projects` itself accepts
 * (`apps/dashboard-api/src/projects/projects.dto.ts`'s `listProjectsQuerySchema`) rather than
 * passed through raw, so a garbled URL degrades to the default query instead of round-tripping an
 * invalid value to the backend.
 */
// Matches apps/dashboard-api/src/projects/projects.dto.ts's listProjectsQuerySchema:
// search: z.string().min(1).max(255). Clamped here, not just via the <input>'s maxLength — a
// request built any other way (a hand-constructed URL, not just paste-then-submit) must not be
// able to send an over-length value and get an uncaught 400 back from getProjects().
const MAX_SEARCH_LENGTH = 255;

export function parseProjectsSearchParams(
  raw: Record<string, string | string[] | undefined>,
): ProjectsQuery {
  const search = firstValue(raw.search)?.trim().slice(0, MAX_SEARCH_LENGTH);
  const status = firstValue(raw.status);
  const sortBy = firstValue(raw.sortBy);
  const sortOrder = firstValue(raw.sortOrder);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    search: search ? search : null,
    status: (STATUS_VALUES as readonly string[]).includes(status ?? "")
      ? (status as ProjectStatusFilter)
      : null,
    sortBy: (SORT_BY_VALUES as readonly string[]).includes(sortBy ?? "")
      ? (sortBy as ProjectSortBy)
      : DEFAULT_QUERY.sortBy,
    sortOrder: (SORT_ORDER_VALUES as readonly string[]).includes(sortOrder ?? "")
      ? (sortOrder as ProjectSortOrder)
      : DEFAULT_QUERY.sortOrder,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
  };
}

/**
 * Builds an `/projects?...` href for a sort-column link or a pagination link — `overrides` wins
 * over `current`, and changing anything other than `offset` itself resets `offset` to 0 (changing
 * the filter/sort while sitting on page 3 should land on a fresh page 1, not silently return zero
 * results for an offset that no longer makes sense against the new query).
 */
export function buildProjectsHref(
  current: ProjectsQuery,
  overrides: Partial<ProjectsQuery>,
): string {
  const next: ProjectsQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.search) params.set("search", next.search);
  if (next.status) params.set("status", next.status);
  if (next.sortBy !== DEFAULT_QUERY.sortBy) params.set("sortBy", next.sortBy);
  if (next.sortOrder !== DEFAULT_QUERY.sortOrder) params.set("sortOrder", next.sortOrder);
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString ? `/projects?${queryString}` : "/projects";
}
