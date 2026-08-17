import { cookies } from "next/headers";
import type {
  ApiSuccessResponse,
  Project,
  ProjectDetail,
  ProjectEnvironment,
  ProjectObjective,
  ProjectRepository,
  ProjectTeamEntry,
  RoadmapItem,
} from "@webdesk/shared-types";
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

export interface ProjectsPageResult {
  readonly items: readonly Project[];
  /** Whether a real next page exists — determined by actually requesting one row past the
   *  display page size (below), not by checking `items.length === PROJECTS_PAGE_SIZE`. That
   *  exact-count heuristic offered a "Next" link on every page whose result count was a multiple
   *  of the page size, which led to a real dead end: the page it linked to was guaranteed empty,
   *  with no filters active to explain it and no pagination controls to get back (the whole
   *  footer, including "Previous", only rendered in the non-empty branch). `GET /projects`
   *  doesn't return a total count to check against, so requesting one extra row is the only way
   *  to know "is there more" without guessing. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — unlike the header switcher's `fetchProjectSummaries()`, this page's
 *  entire content IS the project list, so a fetch failure must surface as a real error state
 *  (propagates to the nearest `error.tsx`), not an empty-looking page. */
export async function getProjects(query: ProjectsQuery): Promise<ProjectsPageResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.status) params.set("status", query.status);
  params.set("sortBy", query.sortBy);
  params.set("sortOrder", query.sortOrder);
  // One row past the display page size — see ProjectsPageResult.hasNextPage's own doc comment.
  params.set("limit", String(PROJECTS_PAGE_SIZE + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/projects?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load projects (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly Project[]>;
  return {
    items: body.data.slice(0, PROJECTS_PAGE_SIZE),
    hasNextPage: body.data.length > PROJECTS_PAGE_SIZE,
  };
}

/** Shared by the list and detail pages — displayed as the raw stored UTC timestamp, not localized;
 *  see the detail page's own note on why (real timezone confirmation is still an open item). */
export function formatTimestamp(iso: string): string {
  return `${iso.slice(0, 16).replace("T", " ")} UTC`;
}

/**
 * Guards a stored URL before it's ever rendered as a clickable `<a href>`. The backend's own
 * validation (`z.string().url()` on `ProjectEnvironment.url`) only confirms the value parses as
 * *some* URL — a `javascript:` URI parses successfully and passes it, so it can reach this page
 * unsanitized. Rendering an unchecked value as an `href` would execute it as script on click, in
 * the viewer's own authenticated session. `http:`/`https:` are the only schemes this app ever
 * intends to link to, so anything else is rendered as inert text instead (see the detail page).
 */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const ROADMAP_ITEM_STATUS_BADGE: Readonly<
  Record<RoadmapItem["status"], { token: StatusToken; label: string }>
> = {
  not_started: { token: "unknown", label: "Not started" },
  active: { token: "healthy", label: "Active" },
  complete: { token: "healthy", label: "Complete" },
  skipped: { token: "notConfigured", label: "Skipped" },
};

/** `active`/`complete` share the `healthy` token — both are non-problem states and the label text
 *  (not color alone) disambiguates them, same reasoning `projectStatusBadge` already establishes. */
export function roadmapItemStatusBadge(status: RoadmapItem["status"]): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return ROADMAP_ITEM_STATUS_BADGE[status];
}

const OBJECTIVE_STATUS_BADGE: Readonly<
  Record<ProjectObjective["status"], { token: StatusToken; label: string }>
> = {
  open: { token: "unknown", label: "Open" },
  complete: { token: "healthy", label: "Complete" },
};

export function objectiveStatusBadge(status: ProjectObjective["status"]): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return OBJECTIVE_STATUS_BADGE[status];
}

export interface ProjectDetailData {
  readonly project: ProjectDetail;
  readonly roadmapItems: readonly RoadmapItem[];
  readonly objectives: readonly ProjectObjective[];
  readonly environments: readonly ProjectEnvironment[];
  readonly repositories: readonly ProjectRepository[];
  /** A real, non-fabricated headcount only — see `ProjectTeamEntry`'s own doc comment for why
   *  individual team-roster identities aren't fetched or shown. */
  readonly teamCount: number;
}

async function fetchProjectSubResource<T>(
  apiBaseUrl: string,
  projectId: string,
  resource: string,
  headers: HeadersInit,
): Promise<readonly T[]> {
  const response = await fetch(`${apiBaseUrl}/projects/${projectId}/${resource}`, {
    headers,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load project ${resource} (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<readonly T[]>).data;
}

/**
 * A promise started for its side effect (an in-flight fetch) that may end up discarded without
 * ever being awaited — e.g. when `getProjectDetail()` below returns early on a 404 while the
 * sub-resource fetches it fired concurrently are still in flight. Node/Next.js logs an
 * "unhandled rejection" warning for a promise that rejects with no handler ever attached to it,
 * even if the caller never intended to look at the result — this attaches a no-op catch so a
 * discarded rejection stays silent, while the original `promise` (returned unchanged) still
 * rejects normally for any caller that does await it.
 */
function tolerateDiscard<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => {});
  return promise;
}

/** Matches the `id`/`publicId` shape every `projects`-table UUID column uses — Postgres accepts
 *  either case, so this isn't anchored to a specific UUID version. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The `GET /projects/:projectId` fetch shared by `getProject()` and `getProjectDetail()` below —
 *  `null` on a 404, throws on any other non-OK status. Assumes `projectId` already passed the
 *  `UUID_PATTERN` short-circuit each caller performs before reaching here. */
async function fetchProject(
  apiBaseUrl: string,
  projectId: string,
  headers: HeadersInit,
): Promise<ProjectDetail | null> {
  const response = await fetch(`${apiBaseUrl}/projects/${projectId}`, {
    headers,
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load project (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<ProjectDetail>).data;
}

/**
 * Fetches a single project only — no sub-resource lists — for pages that don't need them (e.g. the
 * edit form only reads `publicId`/`name`/`description`/`confidentiality`). Same null/throw contract
 * as `getProjectDetail()` below, without the 5 extra `roadmap-items`/`objectives`/`environments`/
 * `repositories`/`team` requests that page's own sub-resource sections need and this one doesn't.
 */
export async function getProject(projectId: string): Promise<ProjectDetail | null> {
  if (!UUID_PATTERN.test(projectId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  return fetchProject(apiBaseUrl, projectId, { cookie: cookieHeader });
}

/**
 * Fetches a single project and its owned sub-resources for the detail page. Returns `null` on a
 * 404 from `GET /projects/:projectId` specifically — the caller renders Next.js's `notFound()` for
 * that case — and throws on any other non-OK status (403, 5xx, ...), same as `getProjects()`
 * above: an authorization or server failure must surface as a real error, not a misleading "this
 * project doesn't exist."
 *
 * `projectId` is untrusted (a reader can type anything into the URL), and this is the first place
 * in the app where an arbitrary URL segment reaches `GET /projects/:projectId` — unlike the list
 * page, nothing upstream already validated it. `dashboard-api` has no route-level UUID validation,
 * so a malformed value (a typo, a stale bookmark, a bot probing the route) would otherwise reach
 * Postgres and come back as a raw 500, not a clean 404. Rejecting an obviously-malformed ID
 * up front, before any network call, treats it the same as "not found" — the honest read of a
 * garbled URL — instead of surfacing the generic error boundary.
 *
 * The sub-resource fetches are started concurrently with the primary fetch, not gated behind it —
 * `GET /projects/:projectId/*` list endpoints don't themselves validate the parent project's
 * existence (a bogus `projectId` returns an empty array, not a 404), so none of them has a genuine
 * data dependency on the primary response. Only the *decision* of whether to keep or discard their
 * results waits on the primary fetch's status, not the fetches themselves — avoiding an extra
 * sequential round trip on every normal (project-exists) page view.
 */
export async function getProjectDetail(projectId: string): Promise<ProjectDetailData | null> {
  if (!UUID_PATTERN.test(projectId)) {
    return null;
  }

  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const headers = { cookie: cookieHeader };

  const roadmapItemsPromise = tolerateDiscard(
    fetchProjectSubResource<RoadmapItem>(apiBaseUrl, projectId, "roadmap-items", headers),
  );
  const objectivesPromise = tolerateDiscard(
    fetchProjectSubResource<ProjectObjective>(apiBaseUrl, projectId, "objectives", headers),
  );
  const environmentsPromise = tolerateDiscard(
    fetchProjectSubResource<ProjectEnvironment>(apiBaseUrl, projectId, "environments", headers),
  );
  const repositoriesPromise = tolerateDiscard(
    fetchProjectSubResource<ProjectRepository>(apiBaseUrl, projectId, "repositories", headers),
  );
  const teamPromise = tolerateDiscard(
    fetchProjectSubResource<ProjectTeamEntry>(apiBaseUrl, projectId, "team", headers),
  );

  const project = await fetchProject(apiBaseUrl, projectId, headers);
  if (!project) {
    return null;
  }

  const [roadmapItems, objectives, environments, repositories, team] = await Promise.all([
    roadmapItemsPromise,
    objectivesPromise,
    environmentsPromise,
    repositoriesPromise,
    teamPromise,
  ]);

  return {
    project,
    roadmapItems,
    objectives,
    environments,
    repositories,
    teamCount: team.length,
  };
}
