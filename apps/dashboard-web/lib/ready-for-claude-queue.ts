import { cookies } from "next/headers";
import type { ApiSuccessResponse, Project, ReadyForClaudeTask } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import { getProjects } from "./projects";
import {
  buildReadyForClaudeQueueHref,
  moduleDisplayName,
  parseReadyForClaudeQueueSearchParams,
  READY_FOR_CLAUDE_TASK_PRIORITY_LABEL,
  READY_FOR_CLAUDE_TASK_PRIORITY_VALUES,
  READY_FOR_CLAUDE_TASK_STATUS_LABEL,
  READY_FOR_CLAUDE_TASK_STATUS_VALUES,
  readyForClaudeTaskStatusBadge,
  sortModulesForPicker,
  type ReadyForClaudeQueueQuery,
} from "./ready-for-claude-queue-query";
import { isUuid } from "./uuid";

export {
  buildReadyForClaudeQueueHref,
  formatTimestamp,
  moduleDisplayName,
  parseReadyForClaudeQueueSearchParams,
  READY_FOR_CLAUDE_TASK_PRIORITY_LABEL,
  READY_FOR_CLAUDE_TASK_PRIORITY_VALUES,
  READY_FOR_CLAUDE_TASK_STATUS_LABEL,
  READY_FOR_CLAUDE_TASK_STATUS_VALUES,
  readyForClaudeTaskStatusBadge,
  sortModulesForPicker,
};
export type { ReadyForClaudeQueueQuery };

export interface ReadyForClaudeTaskListResult {
  readonly items: readonly ReadyForClaudeTask[];
  /** Same "request one row past the chosen page size" technique `getReviews()`/`getServices()`
   *  use — `GET /ready-for-claude-queue/tasks` returns no total count to check against. */
  readonly hasNextPage: boolean;
}

/** Never degrades silently — this page's entire content IS the task list, so a fetch failure must
 *  surface as a real error state (propagates to the nearest `error.tsx`), matching every sibling
 *  module's own list-fetch precedent. */
export async function getReadyForClaudeTasks(
  query: ReadyForClaudeQueueQuery,
): Promise<ReadyForClaudeTaskListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.priority) params.set("priority", query.priority);
  if (query.projectId) params.set("projectId", query.projectId);
  if (query.targetModuleKey) params.set("targetModuleKey", query.targetModuleKey);
  if (query.agent) params.set("agent", query.agent);
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize + 1));
  params.set("offset", String(query.offset));

  const response = await fetch(`${apiBaseUrl}/ready-for-claude-queue/tasks?${params.toString()}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load Ready for Claude tasks (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<readonly ReadyForClaudeTask[]>;
  return {
    items: body.data.slice(0, query.pageSize),
    hasNextPage: body.data.length > query.pageSize,
  };
}

/** Fetches one task. Returns `null` on a 404 or a malformed id (rejected via `isUuid()` before any
 *  network call, the same short-circuit `getReview()`/`getPersona()`/`getService()` use), and
 *  throws on any other non-OK status (403/5xx). */
export async function getReadyForClaudeTask(id: string): Promise<ReadyForClaudeTask | null> {
  if (!isUuid(id)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/ready-for-claude-queue/tasks/${id}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load Ready for Claude task (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<ReadyForClaudeTask>).data;
}

/**
 * Fetches projects to populate the optional `projectId` `<select>` on the create/edit form and
 * the list-page filter — reuses `getProjects()` (the Projects module's own list fetch) rather
 * than a new function, at the largest real `PageSize` option (100), sorted by name for a
 * predictable, scannable `<select>`, mirroring `getServicesForPersonaPicker()`'s own established
 * pattern. `projectId` on this module is an optional context field, not an access boundary (D5),
 * so no project-scoping concern applies to fetching the full list here.
 *
 * Degrades to an empty list on failure rather than throwing (matching
 * `getServicesForPersonaPicker()`'s own precedent) — this is enrichment for an optional field, not
 * this page's primary content, so a transient Projects outage must not crash the whole
 * detail/edit/new task page. Logged here so it's diagnosable server-side rather than invisible.
 */
export async function getProjectsForTaskPicker(): Promise<readonly Project[]> {
  try {
    const { items } = await getProjects({
      search: null,
      status: null,
      sortBy: "name",
      sortOrder: "ASC",
      offset: 0,
      pageSize: 100,
    });
    return items;
  } catch (error) {
    console.error("Failed to load projects for the Ready for Claude task picker:", error);
    return [];
  }
}

/**
 * Fetches other Ready for Claude tasks to populate the `dependencies` `RelationshipPicker` —
 * reuses `getReadyForClaudeTasks()` itself at the largest real `PageSize` option (100), with no
 * filters (every real task is eligible to be named a dependency, not just ones matching the
 * caller's current list-page filters). Excluding the task's own id (no self-dependency) is done
 * by the form component itself, matching `PersonaLibraryForm`'s own filter-in-the-picker
 * convention, not here.
 *
 * Degrades to an empty list on failure (same reasoning as `getProjectsForTaskPicker()` above) —
 * enrichment for an optional relationship field, not this page's primary content.
 */
export async function getReadyForClaudeTasksForDependencyPicker(): Promise<
  readonly ReadyForClaudeTask[]
> {
  try {
    const { items } = await getReadyForClaudeTasks({
      status: null,
      priority: null,
      projectId: null,
      targetModuleKey: null,
      agent: null,
      search: null,
      offset: 0,
      pageSize: 100,
    });
    return items;
  } catch (error) {
    console.error("Failed to load Ready for Claude tasks for the dependencies picker:", error);
    return [];
  }
}
