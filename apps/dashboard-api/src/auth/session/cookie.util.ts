import type { Request, Response } from "express";
import type { AuthEnv } from "../config/auth-env.js";

/**
 * The dashboard-issued session cookie. **Must be SameSite=None, not Strict** — `dashboard-web` and
 * `dashboard-api` are deployed as two separate `*.vercel.app` projects, and `vercel.app` is on the
 * Public Suffix List specifically so each project's own subdomain is its own "site" for
 * cookie/security purposes (the same reason `webdesk-growth-dashboard-theta.vercel.app` and
 * `webdesk-growth-dashboard-7v1u-beta.vercel.app` are isolated from each other by design). Every
 * real API call `dashboard-web` makes to `dashboard-api` — server-side cookie forwarding in
 * `lib/server-session.ts`/`lib/projects.ts`, and the browser's own `credentials: "include"` fetch()
 * in mutation UIs like `components/project-form.tsx` — is therefore genuinely cross-site, and a
 * `SameSite=Strict` cookie is never attached to a cross-site request at all, regardless of
 * `credentials`. `SameSite=None` requires `Secure` (already true by default,
 * `SESSION_COOKIE_SECURE`); CSRF defense for every session-cookie-authenticated mutating route
 * already comes from `OriginCheckGuard` (`@UseGuards(OriginCheckGuard, ...)` on every one of them),
 * not from `SameSite` — matching the OIDC transaction cookie's own precedent
 * (`../google/oidc-transaction.ts`) of choosing `SameSite` based on the traffic pattern actually
 * needed, not defaulting to the strictest option.
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
    sameSite: "none",
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
