/**
 * A best-effort DEFAULT name for `dashboard-web`'s own first-party session cookie — used only as a
 * fallback for code that needs to name the cookie before any server response has told it the
 * authoritative name (currently: `app/auth/session/route.ts`, clearing the local cookie on
 * logout). `app/auth/exchange/route.ts` itself no longer uses this constant to SET the cookie —
 * it uses the `cookieName` `POST /auth/exchange` echoes back from `dashboard-api`'s own
 * `SESSION_COOKIE_NAME` env var (`SessionExchangeResult`, `session.controller.ts`), closing the
 * drift risk this constant used to carry entirely on its own: if `dashboard-api`'s
 * `SESSION_COOKIE_NAME` is ever changed from its default, the cookie is now always written under
 * whatever name is actually configured, not this guess. The residual risk is narrow: a name
 * change taking effect *between* a session being issued and that same session being logged out
 * would still leave a stale cookie under the old name here — accepted as low-severity, matching
 * `CURRENT_PROJECT_COOKIE`/`E2E_SESSION_COOKIE_NAME`'s own precedent of a plain hardcoded default.
 */
export const SESSION_COOKIE_NAME = "wds_session";
