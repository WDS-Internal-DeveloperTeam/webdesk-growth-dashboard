import type { Request, Response } from "express";
import type { AuthEnv } from "../config/auth-env.js";

/**
 * The dashboard-issued session cookie. SameSite=Strict is correct here
 * (unlike the OIDC transaction cookie, ../google/oidc-transaction.ts) — it
 * is only ever read on same-site navigations/API calls made after login,
 * never on a cross-site top-level redirect.
 *
 * The same cookie carries both the emergency-admin pending-MFA session and
 * the final elevated one — the underlying session row (and its token) is
 * the same one, only its `requiresMfa`/`expiresAt` change on elevation
 * (SessionService.elevateAfterMfa). `maxAgeSeconds` lets the login step set
 * a short pending-window cookie lifetime and the TOTP step re-set it to
 * the full session lifetime once elevated — otherwise the browser would
 * silently drop the cookie after the short pending window even though the
 * server-side row had already been extended.
 */
export function setSessionCookie(
  res: Response,
  token: string,
  env: AuthEnv,
  maxAgeSeconds: number = env.SESSION_MAX_AGE_SECONDS,
): void {
  res.cookie(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.SESSION_COOKIE_SECURE,
    sameSite: "strict",
    maxAge: maxAgeSeconds * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response, env: AuthEnv): void {
  res.clearCookie(env.SESSION_COOKIE_NAME, { path: "/" });
}

export function readSessionCookie(req: Request, env: AuthEnv): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[env.SESSION_COOKIE_NAME];
}
