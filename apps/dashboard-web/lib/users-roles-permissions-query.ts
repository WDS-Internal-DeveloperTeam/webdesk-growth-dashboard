import type { StatusToken } from "@webdesk/ui";
import { DEFAULT_PAGE_SIZE, parsePageSize, type PageSize } from "./pagination";
import { firstValue } from "./search-params";

/**
 * `UsersRolesPermissionsQuery`/`parseUsersRolesPermissionsSearchParams`/
 * `buildUsersRolesPermissionsHref`/status-badge helper live in their own file with zero non-type
 * imports, rather than in `lib/users-roles-permissions.ts` where the server-side fetch functions
 * live — so a `"use client"` component (the status-actions island) can import the real functions
 * directly without pulling in `lib/users-roles-permissions.ts`'s `next/headers` import. Same
 * precedent as `lib/persona-library-query.ts`/`lib/help-center-query.ts`.
 */

export const ACCOUNT_STATUS_VALUES = ["active", "disabled"] as const;

/** `unavailable` (danger-tinted), not `notConfigured` — unlike `HelpArticle.isPublished`, a
 *  disabled account is a real access-denial state a reader should read as a warning, not a
 *  neutral "not set up yet." */
export function adminUserStatusBadge(accountStatus: "active" | "disabled"): {
  readonly token: StatusToken;
  readonly label: string;
} {
  return accountStatus === "active"
    ? { token: "healthy", label: "Active" }
    : { token: "unavailable", label: "Disabled" };
}

export interface UsersRolesPermissionsQuery {
  readonly status: "active" | "disabled" | null;
  readonly search: string | null;
  readonly offset: number;
  readonly pageSize: PageSize;
}

/**
 * Next.js `searchParams` is untrusted client input — validated against the same values
 * `GET /users-roles-and-permissions/users` itself accepts
 * (`apps/dashboard-api/src/users-roles-permissions/users-roles-permissions.dto.ts`'s
 * `listUsersQuerySchema`) rather than passed through raw, so a garbled URL degrades to the
 * default query instead of round-tripping an invalid value to the backend.
 */
export function parseUsersRolesPermissionsSearchParams(
  raw: Record<string, string | string[] | undefined>,
): UsersRolesPermissionsQuery {
  const status = firstValue(raw.status);
  const search = firstValue(raw.search);
  const offsetRaw = firstValue(raw.offset);
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : 0;

  return {
    status: ACCOUNT_STATUS_VALUES.includes(status as "active" | "disabled")
      ? (status as "active" | "disabled")
      : null,
    // Clamped to the same 255-char max the backend's own listUsersQuerySchema enforces — matches
    // every sibling list page's own defense-in-depth precedent.
    search: search ? search.slice(0, 255) : null,
    offset: Number.isFinite(offset) && offset > 0 ? offset : 0,
    pageSize: parsePageSize(firstValue(raw.pageSize)),
  };
}

/**
 * Builds a `/users-roles-and-permissions?...` href — `overrides` wins over `current`, and
 * changing anything other than `offset` itself resets `offset` to 0, same convention as
 * `buildHelpCenterHref`.
 */
export function buildUsersRolesPermissionsHref(
  current: UsersRolesPermissionsQuery,
  overrides: Partial<UsersRolesPermissionsQuery>,
): string {
  const next: UsersRolesPermissionsQuery = {
    ...current,
    ...overrides,
    offset: overrides.offset !== undefined ? overrides.offset : 0,
  };
  const params = new URLSearchParams();
  if (next.status) params.set("status", next.status);
  if (next.search) params.set("search", next.search);
  if (next.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(next.pageSize));
  if (next.offset > 0) params.set("offset", String(next.offset));
  const queryString = params.toString();
  return queryString
    ? `/users-roles-and-permissions?${queryString}`
    : "/users-roles-and-permissions";
}
