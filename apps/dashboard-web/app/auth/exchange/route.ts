import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { ApiSuccessResponse, AuthErrorReason } from "@webdesk/shared-types";
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

/**
 * `reason` is typed against the shared `AuthErrorReason` union (`packages/shared-types`), not a
 * locally-declared one — this route and `GoogleAuthController#callback` (`dashboard-api`, the
 * other producer of this value) previously agreed on the value set by convention only, which is
 * exactly the drift risk that let a real backend error get mislabeled `expired` during a
 * 2026-08-19 production incident. See docs/implementation/session-exchange.md.
 *
 * `reason=expired` is reserved for cases that genuinely mean "the exchange code itself is
 * invalid/expired" (a missing `code` param, or the backend's `400` response) — everything else
 * (misconfiguration, network failure, an unexpected non-2xx status, a malformed response body) is
 * a real error, not an expiry, and gets `reason=error` instead.
 */
function redirectToAuthError(
  request: Request,
  reason: AuthErrorReason,
  logMessage?: string,
  logError?: unknown,
): Response {
  if (logMessage) {
    console.error(logMessage, ...(logError !== undefined ? [logError] : []));
  }
  return NextResponse.redirect(new URL(`/auth/error?reason=${reason}`, request.url));
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

type SessionExchangeSuccessBody = ApiSuccessResponse<{
  sessionToken: string;
  expiresAt: string;
  cookieName: string;
}>;

/**
 * `response.json()` succeeding only proves the body is *valid JSON* — not that it has the shape
 * this route expects. Destructuring `body.data` straight off an unvalidated `unknown` would throw
 * if `dashboard-api` ever returned a differently-shaped 200 (a future API-contract drift, or a
 * proxy/CDN substituting its own JSON body), crashing this route with an uncaught exception
 * instead of a clean redirect to `/auth/error` — the exact failure mode every other branch in this
 * file already guards against.
 *
 * Checks `success`/`correlationId` too, not just `data`'s leaf fields — the type predicate claims
 * the full `SessionExchangeSuccessBody` shape, so leaving those two unchecked would let later code
 * trust them as compiler-guaranteed-present when they were never actually validated. `expiresAt`
 * is also checked for being a *parseable* date, not just a string — an unparseable value would
 * otherwise flow into `new Date(expiresAt).getTime()` as `NaN`, silently degrading the session
 * cookie's `Max-Age` to an invalid value instead of failing loudly here.
 */
function isSessionExchangeSuccessBody(value: unknown): value is SessionExchangeSuccessBody {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { success, data, correlationId } = value as Record<string, unknown>;
  if (success !== true || typeof correlationId !== "string") {
    return false;
  }
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const { sessionToken, expiresAt, cookieName } = data as Record<string, unknown>;
  return (
    typeof sessionToken === "string" &&
    typeof expiresAt === "string" &&
    !Number.isNaN(new Date(expiresAt).getTime()) &&
    typeof cookieName === "string"
  );
}

/**
 * A safe, values-free summary of a response body that failed `isSessionExchangeSuccessBody` — logs
 * enough to diagnose *what* was missing/wrong-shaped without ever printing field values. The
 * shape-mismatch case this guards is the one path in this file where the response body could, on a
 * future backend drift, still carry a real `sessionToken` alongside the one field that changed —
 * logging the raw body here would risk that live credential landing in server logs.
 */
function describeUnexpectedBody(value: unknown): unknown {
  if (typeof value !== "object" || value === null) {
    return { typeOf: typeof value };
  }
  return { topLevelKeys: Object.keys(value) };
}

export async function GET(request: Request): Promise<Response> {
  const code = new URL(request.url).searchParams.get("code");
  if (!code) {
    return redirectToAuthError(request, "expired");
  }

  let apiBaseUrl: string;
  try {
    apiBaseUrl = getApiBaseUrl();
  } catch (error) {
    return redirectToAuthError(
      request,
      "error",
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
    return redirectToAuthError(
      request,
      "error",
      "auth/exchange: POST /auth/exchange request failed",
      error,
    );
  }

  if (!response.ok) {
    // A bare `response.status === 400` check assumes every 400 from `POST /auth/exchange` means
    // "invalid/expired code" (`SessionController#exchange`'s `BadRequestException`). That holds
    // today only because `sessionExchangeSchema` (`session-exchange.dto.ts`) is a single required
    // `code: z.string().min(1)` field, and `code` is already guarded non-empty above — so the
    // ZodValidationPipe's own 400 path can't currently be reached from this caller. If that DTO
    // ever grows a second field, a validation-error 400 would silently masquerade as "expired"
    // here too. Not fixed now — distinguishing them needs a real backend contract change (e.g. a
    // distinct error code in the response body), its own separate, not-yet-requested scope.
    return response.status === 400
      ? redirectToAuthError(request, "expired")
      : redirectToAuthError(
          request,
          "error",
          `auth/exchange: POST /auth/exchange returned status ${response.status}`,
        );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error) {
    return redirectToAuthError(
      request,
      "error",
      "auth/exchange: POST /auth/exchange returned a malformed response body",
      error,
    );
  }
  if (!isSessionExchangeSuccessBody(body)) {
    return redirectToAuthError(
      request,
      "error",
      "auth/exchange: POST /auth/exchange returned an unexpected response shape",
      describeUnexpectedBody(body),
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
