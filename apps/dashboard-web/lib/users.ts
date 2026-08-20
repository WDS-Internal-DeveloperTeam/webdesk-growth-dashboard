import { cookies } from "next/headers";
import type { ApiSuccessResponse, UserSummary } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { isUuid } from "./uuid";

/**
 * Resolves a single, already-known user id to a display summary — server-side only, for a page
 * that needs to show who a project's current owner is before the `UserPicker` client
 * component's own search is ever used (e.g. `/projects/:id/edit`). `null` on a 404 or a malformed
 * id (mirrors `getProject()`'s own null/throw contract), throws on any other non-OK status.
 */
export async function getUser(userId: string): Promise<UserSummary | null> {
  if (!isUuid(userId)) {
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
 * exposed over HTTP yet, though `UsersService.findByIds()` exists internally; team rosters are
 * expected to stay small — tracked as debt, see `docs/implementation/dashboard-web-team-approver-management.md`).
 * Deduplicates ids first so a roster with repeated entries never issues the same lookup twice.
 *
 * Uses `Promise.allSettled`, not `Promise.all` — `getUser()` throws on any non-404 non-OK status
 * (a 403, for instance, since `GET /users/:userId` requires `users_roles:view`, a permission most
 * roles that can otherwise view a team roster don't hold), and a caller resolving many ids at once
 * must not have one bad/forbidden id take down the whole batch (code-review finding, this branch —
 * `getProjectDetail()`'s own caller has no try/catch around this, so an unhandled rejection here
 * previously crashed the entire Project Detail page). An id that fails to resolve for any reason
 * — 404, 403, or a network error — is simply absent from the returned map rather than throwing;
 * callers render an "Unknown member" fallback for a missing key instead of losing the whole roster
 * to one bad id. Failures are logged (except the already-expected 404 case, which `getUser()`
 * itself treats as a normal `null`) so a real backend regression here doesn't go unnoticed.
 */
export async function getUsersByIds(
  userIds: readonly string[],
): Promise<ReadonlyMap<string, UserSummary>> {
  const uniqueIds = [...new Set(userIds)];
  const results = await Promise.allSettled(uniqueIds.map((id) => getUser(id)));
  const map = new Map<string, UserSummary>();
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      if (result.value) {
        map.set(uniqueIds[index]!, result.value);
      }
    } else {
      console.error(`getUsersByIds: failed to resolve user ${uniqueIds[index]}`, result.reason);
    }
  });
  return map;
}
