import { cookies } from "next/headers";
import { cache } from "react";
import type { ApiSuccessResponse, ModuleRegistrySummary } from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";

/**
 * Server-side session resolution for the application shell (Phase 1F
 * brief §8-§10). `dashboard-web` never reads the session cookie's
 * contents itself (ADR-0002/the Google auth contract's trust boundary) —
 * this forwards the raw cookie header to `dashboard-api` and trusts its
 * 401 as the sole signal of "not authenticated."
 */

export interface ServerSessionProfile {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
}

export interface ServerSession {
  readonly me: ServerSessionProfile;
  readonly navigation: readonly ModuleRegistrySummary[];
}

/**
 * `getApiBaseUrl()` throws when unconfigured — treated as "cannot be
 * authenticated," not a crash, so environments with no real backend (the
 * Playwright smoke-test fixture, `/auth/sign-in` itself) don't crash. But a
 * genuinely missing `NEXT_PUBLIC_API_BASE_URL` in a real deployment is a
 * real misconfiguration (the exact class of bug behind the 2026-08-12
 * production `500` on `/auth/sign-in` — see CLAUDE.md's decision log) that
 * would otherwise disappear into an ordinary-looking "please sign in"
 * redirect with zero trace. Logged here so it's still visible in Vercel's
 * runtime logs even though the user only ever sees "signed out."
 */
function tryGetApiBaseUrl(): string | null {
  try {
    return getApiBaseUrl();
  } catch (error) {
    console.error("getServerSession: NEXT_PUBLIC_API_BASE_URL is not configured", error);
    return null;
  }
}

/**
 * Resolves the current request's session server-side, or `null` if there is
 * no valid session (no cookie, or `dashboard-api` returns 401). Any OTHER
 * failure (network error, 5xx, unexpected shape) is thrown rather than
 * silently treated as "signed out" — an API outage must surface as an
 * error, not a misleading prompt to log back in (brief §19's own
 * error-handling philosophy).
 *
 * Wrapped in React's `cache()` so the `(shell)` layout and a page under it
 * (e.g. `home/page.tsx`) both calling this for the same request share one
 * real pair of `dashboard-api` calls — Next.js's fetch memoization already
 * happens to dedupe this implicitly today, but that's an incidental
 * property of identical fetch args during a render pass, not a guarantee;
 * `cache()` makes the dedup explicit and robust against future refactors.
 */
export const getServerSession = cache(async (): Promise<ServerSession | null> => {
  const apiBaseUrl = tryGetApiBaseUrl();
  if (!apiBaseUrl) {
    return null;
  }

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  if (!cookieHeader) {
    return null;
  }

  const headers = { cookie: cookieHeader };
  const [meResponse, navigationResponse] = await Promise.all([
    fetch(`${apiBaseUrl}/me`, { headers, cache: "no-store" }),
    fetch(`${apiBaseUrl}/me/navigation`, { headers, cache: "no-store" }),
  ]);

  if (meResponse.status === 401 || navigationResponse.status === 401) {
    return null;
  }
  if (!meResponse.ok || !navigationResponse.ok) {
    throw new Error(
      `Failed to load session (me: ${meResponse.status}, navigation: ${navigationResponse.status})`,
    );
  }

  const meBody = (await meResponse.json()) as ApiSuccessResponse<ServerSessionProfile>;
  const navigationBody = (await navigationResponse.json()) as ApiSuccessResponse<
    readonly ModuleRegistrySummary[]
  >;

  return { me: meBody.data, navigation: navigationBody.data };
});
