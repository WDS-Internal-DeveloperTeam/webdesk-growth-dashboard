import { cookies } from "next/headers";
import { cache } from "react";
import type {
  ApiSuccessResponse,
  HealthCheckResult,
  ModuleRegistrySummary,
  ProjectSummary,
} from "@webdesk/shared-types";
import { getApiBaseUrl } from "./auth";
import {
  E2E_SESSION_COOKIE_NAME,
  getE2eFixtureSession,
  isE2eSessionCookieValid,
  isE2eTestModeEnabled,
} from "./e2e-test-session";

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

export interface ServerSessionSystemStatus {
  readonly environment: string | null;
  readonly isDegraded: boolean;
  /** From `/health`'s `build` block — real deploy metadata for the Home page's Git/Release Status
   *  widget. `null` together (never partially populated) when `/health` didn't return a `build`
   *  block at all, e.g. the E2E test fixture and any environment that predates build-metadata
   *  wiring. */
  readonly release: {
    readonly version: string;
    readonly commitShaShort: string;
    readonly deployedAt: string;
  } | null;
}

export interface ServerSession {
  readonly me: ServerSessionProfile;
  readonly navigation: readonly ModuleRegistrySummary[];
  readonly projects: readonly ProjectSummary[];
  readonly systemStatus: ServerSessionSystemStatus;
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
 * `limit=200` (the backend's own `MAX_LIST_LIMIT`) rather than no query at all — the unqualified
 * call was silently capped at the backend's `DEFAULT_LIST_LIMIT` of 50, so an org with more
 * projects than that would have some silently missing from the switcher, including a caller's own
 * previously-selected project falling out of the returned page and being wrongly treated as
 * stale/inaccessible. This raises the threshold, it doesn't remove it — a real "browse/search all
 * projects" UI (D7-adjacent, still undesigned) is the actual fix if project counts ever approach
 * 200.
 */
const PROJECTS_FETCH_QUERY = "?limit=200";

/**
 * Never throws or rejects — unlike `/me`/`/me/navigation`, a `/projects` failure (network error OR
 * bad HTTP status) degrades to an empty list, since the Project Switcher is header chrome, not an
 * authentication gate. Every failure is still logged, matching `tryGetApiBaseUrl()`'s own pattern
 * above: a silent, unlogged degrade is exactly the blind spot that made the 2026-08-12 production
 * incident (documented in this repo's `CLAUDE.md`) invisible until deliberately instrumented.
 */
async function fetchProjectSummaries(
  apiBaseUrl: string,
  headers: HeadersInit,
): Promise<readonly ProjectSummary[]> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/projects${PROJECTS_FETCH_QUERY}`, {
      headers,
      cache: "no-store",
    });
  } catch (error) {
    console.error("getServerSession: GET /projects request failed", error);
    return [];
  }
  if (!response.ok) {
    console.error(`getServerSession: GET /projects returned status ${response.status}`);
    return [];
  }
  return ((await response.json()) as ApiSuccessResponse<readonly ProjectSummary[]>).data;
}

const DEFAULT_SYSTEM_STATUS: ServerSessionSystemStatus = {
  environment: null,
  isDegraded: false,
  release: null,
};

/**
 * Header environment/system-status indicators (`04-navigation-system.md`
 * §2) — `/health` needs no session cookie, so this never blocks or
 * fails the session as a whole; a failure here just means the two
 * conditional indicators stay hidden (their "no signal" state is
 * indistinguishable from "everything is fine," which is the correct
 * fail-safe for a purely informational, non-authoritative badge).
 */
async function fetchSystemStatus(apiBaseUrl: string): Promise<ServerSessionSystemStatus> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/health`, { cache: "no-store" });
  } catch (error) {
    console.error("getServerSession: GET /health request failed", error);
    return DEFAULT_SYSTEM_STATUS;
  }
  if (!response.ok) {
    console.error(`getServerSession: GET /health returned status ${response.status}`);
    return DEFAULT_SYSTEM_STATUS;
  }
  const body = (await response.json()) as HealthCheckResult;
  return {
    environment: body.build?.environment ?? null,
    isDegraded: body.status !== "ok",
    release: body.build
      ? {
          version: body.build.version,
          commitShaShort: body.build.commitShaShort,
          deployedAt: body.build.processStartedAt,
        }
      : null,
  };
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
 * real set of `dashboard-api` calls — Next.js's fetch memoization already
 * happens to dedupe this implicitly today, but that's an incidental
 * property of identical fetch args during a render pass, not a guarantee;
 * `cache()` makes the dedup explicit and robust against future refactors.
 *
 * Also loads `GET /projects` for the header Project Switcher (every real role holds
 * `project_configuration:view` per `06_Roles_and_Permissions.md §3`, so this should never 401 for
 * an authenticated caller in practice) — bundled here rather than fetched separately by the
 * switcher component so it's one server-rendered set of session data, not a client-side loading
 * flash on every page.
 */
export const getServerSession = cache(async (): Promise<ServerSession | null> => {
  // Test-only bypass (see lib/e2e-test-session.ts's own doc comment for the full security
  // reasoning) — gated on NODE_ENV, which no real deployment can set to non-production, so this
  // branch is dead code in every real deployment regardless of what any request contains.
  if (isE2eTestModeEnabled()) {
    const cookieStore = await cookies();
    if (isE2eSessionCookieValid(cookieStore.get(E2E_SESSION_COOKIE_NAME)?.value)) {
      return getE2eFixtureSession();
    }
  }

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
  // `fetchProjectSummaries`/`fetchSystemStatus` never reject (see their own doc comments) — unlike
  // the two calls below, a failure in either must not fail this whole `Promise.all` and take down
  // `me`/`navigation` with it, which a raw `fetch()` here would do (fetch() rejects on network
  // errors, not just resolves with a bad status, so the `.ok` checks below would never even run).
  const [meResponse, navigationResponse, projects, systemStatus] = await Promise.all([
    fetch(`${apiBaseUrl}/me`, { headers, cache: "no-store" }),
    fetch(`${apiBaseUrl}/me/navigation`, { headers, cache: "no-store" }),
    fetchProjectSummaries(apiBaseUrl, headers),
    fetchSystemStatus(apiBaseUrl),
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

  return { me: meBody.data, navigation: navigationBody.data, projects, systemStatus };
});
