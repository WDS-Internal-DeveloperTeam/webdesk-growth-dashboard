import { cookies } from "next/headers";
import type { ApiSuccessResponse, UserSummary } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";

/** Same UUID short-circuit `lib/projects.ts`'s `getProject()` already uses — a malformed id is the
 *  honest read of a garbled value, not a network call worth making. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves a single, already-known user id to a display summary — server-side only, for a page
 * that needs to show who a project's current owner is before the `UserPicker` client
 * component's own search is ever used (e.g. `/projects/:id/edit`). `null` on a 404 or a malformed
 * id (mirrors `getProject()`'s own null/throw contract), throws on any other non-OK status.
 */
export async function getUser(userId: string): Promise<UserSummary | null> {
  if (!UUID_PATTERN.test(userId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const response = await fetch(`${apiBaseUrl}/users/${userId}`, {
    headers: { cookie: cookieStore.toString() },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load user (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<UserSummary>).data;
}

/**
 * Resolves several user ids at once — N parallel `getUser()` calls (no batch-resolve endpoint
 * exists; team rosters are small, see `ProjectTeamEntry`'s own doc comment). Deduplicates ids
 * first so a roster with repeated entries never issues the same lookup twice. An id that fails to
 * resolve (deleted/disabled account, matching `getUser()`'s own null-on-404 contract) is simply
 * absent from the returned map rather than throwing — callers render an "Unknown member" fallback
 * for a missing key instead of losing the whole roster to one bad id.
 */
export async function getUsersByIds(
  userIds: readonly string[],
): Promise<ReadonlyMap<string, UserSummary>> {
  const uniqueIds = [...new Set(userIds)];
  const resolved = await Promise.all(uniqueIds.map((id) => getUser(id)));
  const map = new Map<string, UserSummary>();
  resolved.forEach((user, index) => {
    if (user) {
      map.set(uniqueIds[index]!, user);
    }
  });
  return map;
}
