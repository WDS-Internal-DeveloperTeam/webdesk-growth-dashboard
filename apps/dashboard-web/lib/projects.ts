import { cookies } from "next/headers";
import type { ApiSuccessResponse, Project } from "@webdesk/shared-types";
import type { StatusToken } from "@webdesk/ui";
import { getApiBaseUrl } from "./auth";

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
export function parseProjectsSearchParams(
  raw: Record<string, string | string[] | undefined>,
): ProjectsQuery {
  const search = firstValue(raw.search)?.trim();
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

const STATUS_BADGE: Readonly<Record<ProjectStatusFilter, { token: StatusToken; label: string }>> = {
  active: { token: "healthy", label: "Active" },
  paused: { token: "degraded", label: "Paused" },
  archived: { token: "unknown", label: "Archived" },
};

/** Maps a project's lifecycle status (D2, `docs/task-packages/module-projects-foundation.md`) onto
 *  the shared design system's semantic status tokens — active/paused/archived are this module's own
 *  vocabulary, not one of `statusTokens`' keys, so this is the one place that translation happens. */
export function projectStatusBadge(status: ProjectStatusFilter): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return STATUS_BADGE[status];
}

/** Never degrades silently — unlike the header switcher's `fetchProjectSummaries()`, this page's
 *  entire content IS the project list, so a fetch failure must surface as a real error state
 *  (propagates to the nearest `error.tsx`), not an empty-looking page. */
export async function getProjects(query: ProjectsQuery): Promise<readonly Project[]> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  params.set("sortBy", query.sortBy);
  params.set("sortOrder", query.sortOrder);
  params.set("limit", String(PROJECTS_PAGE_SIZE));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/projects?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load projects (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly Project[]>;
  return body.data;
}
