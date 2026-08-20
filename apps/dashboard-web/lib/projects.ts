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
  UserSummary,
} from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import {
  buildProjectsHref,
  parseProjectsSearchParams,
  PROJECTS_PAGE_SIZE,
  type ProjectSortBy,
  type ProjectSortOrder,
  type ProjectStatusFilter,
  type ProjectsQuery,
} from "./projects-query";
import { isSafeHttpUrl } from "./safe-http-url";
import { objectiveStatusBadge, projectStatusBadge, roadmapItemStatusBadge } from "./status-badges";
import { getUsersByIds } from "./users";

export {
  buildProjectsHref,
  formatTimestamp,
  isSafeHttpUrl,
  objectiveStatusBadge,
  parseProjectsSearchParams,
  projectStatusBadge,
  PROJECTS_PAGE_SIZE,
  roadmapItemStatusBadge,
};
export type { ProjectSortBy, ProjectSortOrder, ProjectStatusFilter, ProjectsQuery };

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

/** A team-roster entry with its `userId` resolved to a display identity where possible — `user` is
 *  `null` for an id that no longer resolves (disabled/deleted account), so the roster stays
 *  fully rendered instead of one bad id dropping the whole list. */
export interface ResolvedTeamMember {
  readonly id: string;
  readonly addedAt: string;
  readonly user: UserSummary | null;
}

export interface ProjectDetailData {
  readonly project: ProjectDetail;
  readonly roadmapItems: readonly RoadmapItem[];
  readonly objectives: readonly ProjectObjective[];
  readonly environments: readonly ProjectEnvironment[];
  readonly repositories: readonly ProjectRepository[];
  readonly team: readonly ResolvedTeamMember[];
  /** `null` means the caller lacks `users_roles:view` (the permission `GET .../approvers` itself
   *  is gated on), so the section renders nothing at all, not an empty list — distinct from `[]`,
   *  a real project with zero approvers currently assigned. */
  readonly approvers: readonly UserSummary[] | null;
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
 * Unlike `fetchProjectSubResource()` above, a non-OK response here degrades to `null` instead of
 * throwing — `GET /projects/:projectId/approvers` is gated on `users_roles:view`, a permission
 * most roles don't hold, so a 403 is an expected, routine outcome (the section simply isn't shown
 * to that viewer), not a real failure the page's error boundary should ever see. Still logged —
 * a 403 and a genuine 5xx both degrade to the same `null`, but only logging lets a real backend
 * regression here be told apart from routine permission denial (code-review finding, this branch:
 * this function's own doc comment already cited `fetchProjectSummaries()` as the model to follow,
 * but originally only copied its network-catch logging, not its `!response.ok`-path logging too).
 */
async function fetchProjectApprovers(
  apiBaseUrl: string,
  projectId: string,
  headers: HeadersInit,
): Promise<readonly UserSummary[] | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/projects/${projectId}/approvers`, {
      headers,
      cache: "no-store",
    });
    if (!response.ok) {
      console.error(`getProjectDetail: GET .../approvers returned status ${response.status}`);
      return null;
    }
    return ((await response.json()) as ApiSuccessResponse<readonly UserSummary[]>).data;
  } catch (err) {
    console.error("getProjectDetail: GET .../approvers request failed", err);
    return null;
  }
}

/**
 * Resolves a raw team roster's `userId`s to display identities, folded into the same concurrent
 * fetch pass `getProjectDetail()` already runs — chained directly off `teamPromise` (via
 * `.then()`) rather than awaited only after every other sub-resource fetch settles, so identity
 * resolution can start the moment the team list itself arrives instead of waiting on the slowest
 * of the unrelated roadmap/objectives/environments/repositories/approvers fetches too
 * (code-review finding, this branch).
 */
async function resolveTeam(
  teamPromise: Promise<readonly ProjectTeamEntry[]>,
): Promise<readonly ResolvedTeamMember[]> {
  const rawTeam = await teamPromise;
  const teamUsers = await getUsersByIds(rawTeam.map((entry) => entry.userId));
  return rawTeam.map((entry) => ({
    id: entry.id,
    addedAt: entry.addedAt,
    user: teamUsers.get(entry.userId) ?? null,
  }));
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
  const resolvedTeamPromise = tolerateDiscard(resolveTeam(teamPromise));
  const approversPromise = fetchProjectApprovers(apiBaseUrl, projectId, headers);

  const project = await fetchProject(apiBaseUrl, projectId, headers);
  if (!project) {
    return null;
  }

  const [roadmapItems, objectives, environments, repositories, team, approvers] = await Promise.all(
    [
      roadmapItemsPromise,
      objectivesPromise,
      environmentsPromise,
      repositoriesPromise,
      resolvedTeamPromise,
      approversPromise,
    ],
  );

  return {
    project,
    roadmapItems,
    objectives,
    environments,
    repositories,
    team,
    approvers,
  };
}
