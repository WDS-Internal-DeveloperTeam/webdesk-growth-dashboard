/**
 * The name of `dashboard-web`'s own first-party session cookie, set by
 * `app/auth/exchange/route.ts` once it redeems a session-exchange code. Must match
 * `dashboard-api`'s `SESSION_COOKIE_NAME` env value (default `"wds_session"`,
 * `apps/dashboard-api/src/auth/config/auth-env.ts`) — `lib/server-session.ts` forwards this
 * app's own incoming `Cookie` header verbatim to `dashboard-api`, which reads the session token
 * back out by that exact key (`session/cookie.util.ts#readSessionCookie`). There is no shared
 * config between the two deployments to enforce this at build time; `dashboard-api`'s env var has
 * never been overridden from its default in any recorded deployment (see CLAUDE.md's setup-input
 * history), so the literal below is kept in sync by convention, matching `CURRENT_PROJECT_COOKIE`/
 * `E2E_SESSION_COOKIE_NAME`'s own precedent of a plain hardcoded constant.
 */
export const SESSION_COOKIE_NAME = "wds_session";
