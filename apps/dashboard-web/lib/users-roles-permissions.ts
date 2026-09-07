import { cookies } from "next/headers";
import type {
  AdminUser,
  AdminUserDetail,
  ApiSuccessResponse,
  PermissionMatrix,
} from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import { formatTimestamp } from "./format-timestamp";
import {
  ACCOUNT_STATUS_VALUES,
  adminUserStatusBadge,
  buildUsersRolesPermissionsHref,
  parseUsersRolesPermissionsSearchParams,
  type UsersRolesPermissionsQuery,
} from "./users-roles-permissions-query";
import { isUuid } from "./uuid";

export {
  ACCOUNT_STATUS_VALUES,
  adminUserStatusBadge,
  buildUsersRolesPermissionsHref,
  formatTimestamp,
  parseUsersRolesPermissionsSearchParams,
};
export type { UsersRolesPermissionsQuery };

export interface AdminUserListResult {
  readonly items: readonly AdminUser[];
  readonly total: number;
}

/**
 * Never degrades silently — this page's entire content IS the user directory, so a fetch failure
 * must surface as a real error state (propagates to the nearest `error.tsx`), matching
 * `getPersonas()`/`getHelpArticles()`'s own precedent.
 *
 * Unlike every sibling list fetch in this app, `GET /users-roles-and-permissions/users` returns a
 * real `total` count (`UserRepository.listAll()`'s own doc comment: an admin directory listing,
 * not a picker), so this requests exactly `pageSize` rows rather than the "request one extra row"
 * technique `getPersonas()`/`getServices()` use to detect a next page without a count query.
 */
export async function getAdminUsers(
  query: UsersRolesPermissionsQuery,
): Promise<AdminUserListResult> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.search) params.set("search", query.search);
  params.set("limit", String(query.pageSize));
  params.set("offset", String(query.offset));

  const response = await fetch(
    `${apiBaseUrl}/users-roles-and-permissions/users?${params.toString()}`,
    { headers: { cookie: cookieHeader }, cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(`Failed to load users (status ${response.status})`);
  }
  const body = (await response.json()) as ApiSuccessResponse<{
    rows: readonly AdminUser[];
    total: number;
  }>;
  return { items: body.data.rows, total: body.data.total };
}

/**
 * Fetches one user's full admin-directory detail (every role assignment, global and
 * project-scoped). Returns `null` on a 404 (the caller renders `notFound()`) or a malformed id
 * (rejected via `isUuid()` before any network call, the same short-circuit `getPersona()`/
 * `getHelpArticle()` use), and throws on any other non-OK status (403/5xx).
 */
export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  if (!isUuid(userId)) {
    return null;
  }
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/users-roles-and-permissions/users/${userId}`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`Failed to load user (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<AdminUserDetail>).data;
}

/** Never degrades silently — the matrix page's entire content IS this data, matching every other
 *  primary-content fetch in this app. */
export async function getPermissionMatrix(): Promise<PermissionMatrix> {
  const apiBaseUrl = getApiBaseUrl();
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const response = await fetch(`${apiBaseUrl}/users-roles-and-permissions/matrix`, {
    headers: { cookie: cookieHeader },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to load the permission matrix (status ${response.status})`);
  }
  return ((await response.json()) as ApiSuccessResponse<PermissionMatrix>).data;
}
