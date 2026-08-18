import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import { getApiBaseUrl } from "../../../lib/auth";

/**
 * Redeems a single-use session-exchange code minted by `dashboard-api`'s Google OIDC callback
 * (`apps/dashboard-api/src/auth/google/google-auth.controller.ts`) and sets `dashboard-web`'s own
 * first-party session cookie from the result — the fix for the cross-domain cookie-scoping bug
 * documented in `docs/implementation/session-exchange.md`: `dashboard-api`'s own session cookie is
 * host-only to its own domain (no `Domain` attribute, and the two apps have no shared parent domain
 * to scope one to), so it never reaches `dashboard-web` on its own separate `*.vercel.app` project.
 *
 * This is a server-to-server call (`fetch` from this Route Handler to `dashboard-api`, not a
 * browser-mediated one), authenticated purely by possession of the code — see
 * `SessionController#exchange`'s own doc comment for why no cookie/`OriginCheckGuard` applies at
 * that leg. The code is single-use and short-lived (`SESSION_EXCHANGE_CODE_MAX_AGE_SECONDS`,
 * default 60s) — this handler is the only intended redeemer, reached only via the top-level
 * redirect `GoogleAuthController#callback` itself issues immediately after minting it.
 */

function redirectToAuthError(request: Request, logMessage?: string, logError?: unknown): Response {
  if (logMessage) {
    console.error(logMessage, ...(logError !== undefined ? [logError] : []));
  }
  return NextResponse.redirect(new URL("/auth/error?reason=expired", request.url));
}

/**
 * Cookies set over plain HTTP are silently refused by browsers when marked `Secure` — mirrors
 * `dashboard-api`'s own `SESSION_COOKIE_SECURE` env var (`auth-env.ts`), which exists for the
 * identical reason: local dev runs `dashboard-web` over `http://localhost` by default (see
 * `.env.example`'s `NEXT_PUBLIC_API_BASE_URL`), where a hardcoded `secure: true` would silently
 * drop the cookie with no visible error. Server-only (no `NEXT_PUBLIC_` prefix) — never read by
 * client code, only by this Route Handler.
 */
function isSecureCookieEnabled(): boolean {
  return process.env.SESSION_COOKIE_SECURE !== "false";
}

export async function GET(request: Request): Promise<Response> {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) {
    return redirectToAuthError(request);
  }

  let apiBaseUrl: string;
  try {
    apiBaseUrl = getApiBaseUrl();
  } catch (error) {
    return redirectToAuthError(
      request,
      "auth/exchange: NEXT_PUBLIC_API_BASE_URL is not configured",
      error,
    );
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/auth/exchange`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
      cache: "no-store",
    });
  } catch (error) {
    return redirectToAuthError(request, "auth/exchange: POST /auth/exchange request failed", error);
  }

  if (!response.ok) {
    return redirectToAuthError(
      request,
      response.status === 400
        ? undefined
        : `auth/exchange: POST /auth/exchange returned status ${response.status}`,
    );
  }

  let body: ApiSuccessResponse<{ sessionToken: string; expiresAt: string; cookieName: string }>;
  try {
    body = await response.json();
  } catch (error) {
    return redirectToAuthError(
      request,
      "auth/exchange: POST /auth/exchange returned a malformed response body",
      error,
    );
  }
  const { sessionToken, expiresAt, cookieName } = body.data;

  const maxAgeSeconds = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
  );

  const cookieStore = await cookies();
  cookieStore.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: isSecureCookieEnabled(),
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });

  return NextResponse.redirect(new URL("/home", request.url));
}
