import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import { getApiBaseUrl } from "../../../lib/auth";
import { SESSION_COOKIE_NAME } from "../../../lib/session-cookie";

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
export async function GET(request: Request): Promise<Response> {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/auth/error?reason=expired", request.url));
  }

  let apiBaseUrl: string;
  try {
    apiBaseUrl = getApiBaseUrl();
  } catch (error) {
    console.error("auth/exchange: NEXT_PUBLIC_API_BASE_URL is not configured", error);
    return NextResponse.redirect(new URL("/auth/error?reason=expired", request.url));
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
    console.error("auth/exchange: POST /auth/exchange request failed", error);
    return NextResponse.redirect(new URL("/auth/error?reason=expired", request.url));
  }

  if (!response.ok) {
    if (response.status !== 400) {
      console.error(`auth/exchange: POST /auth/exchange returned status ${response.status}`);
    }
    return NextResponse.redirect(new URL("/auth/error?reason=expired", request.url));
  }

  const body = (await response.json()) as ApiSuccessResponse<{
    sessionToken: string;
    expiresAt: string;
  }>;
  const { sessionToken, expiresAt } = body.data;

  const maxAgeSeconds = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000),
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });

  return NextResponse.redirect(new URL("/home", request.url));
}
