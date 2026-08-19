# Cross-Domain Session Exchange (as-built)

**Status:** Records what was actually built to fix a real production authentication bug — Google
Workspace SSO login completed successfully at Google's consent screen, but the user was never
actually signed into `dashboard-web` and landed back on `/auth/sign-in` in a loop. Built on branch
`fix-cross-domain-session-exchange`, off `main` at `32e5bba` (the commit recording PR #34's merge —
the `dashboard-web` Team management + Approver assignment UI).

## 1. The bug and its root cause

The user reported: sign-in with Google appeared to work the first time, but on a later attempt it
"showed progress and kept showing the same page" and never redirected to the authenticated app.

Root cause, found by directly reading `apps/dashboard-api/src/auth/session/cookie.util.ts` and
`apps/dashboard-web/lib/server-session.ts`: `dashboard-api`'s Google OIDC callback
(`GoogleAuthController#callback`) issued a session and set it as a cookie via `res.cookie(...)`,
then redirected the browser straight to `WEB_APP_ORIGIN`'s root. That cookie carries no `Domain`
attribute, which makes it **host-only** to `dashboard-api`'s own origin (RFC 6265) — and
`dashboard-web`/`dashboard-api` are two separate `*.vercel.app` projects with no shared parent
domain to scope a cookie to (the same Public Suffix List fact already recorded in
`cookie.util.ts`'s own `SameSite=None` doc comment, for a different reason). The browser therefore
never sent that cookie on the subsequent navigation to `dashboard-web` — `getServerSession()`'s
server-side `cookies()` read found nothing, `dashboard-web` treated the visitor as signed out, and
the `(shell)` layout's session gate bounced them straight back to `/auth/sign-in`.

This was **not** a `SameSite` misconfiguration — `SameSite=None; Secure` is already correct for the
genuinely cross-site requests this app makes (server-side cookie-forwarding fetches, and browser
`credentials: "include"` mutation fetches like `project-form.tsx`'s). Both of those are requests
_to_ `dashboard-api`, which do carry the cookie correctly. The broken case is different: it's the
browser's own top-level navigation _away from_ `dashboard-api` and _to_ `dashboard-web`, which was
never a request `dashboard-api`'s cookie could reach in the first place, regardless of `SameSite`.

**Why this went undetected for so long**: every prior "verified live" deployment check in this
project's history (recorded throughout `CLAUDE.md`) only tested the _unauthenticated_ redirect
(`/` → `/auth/sign-in` for a signed-out visitor) — never a real completed login through the full
authenticated shell. The automated Playwright accessibility suite deliberately uses a test-only
session bypass (`lib/e2e-test-session.ts`) specifically because a real SSO login can't be exercised
in CI. So the real cross-domain cookie path was never actually exercised by any check, human or
automated, since the authenticated shell was built in Phase 1F (2026-08-14).

A related, but explicitly out-of-scope, finding: the emergency-admin TOTP page
(`app/auth/emergency/totp/page.tsx`) has the _same_ underlying bug via a different mechanism — it
submits via a client-side `fetch(credentials: "include")` to `dashboard-api` (which does correctly
receive the `SameSite=None` cookie in the response) and then calls `router.push("/")`, but the
_browser_ still never holds a `dashboard-web`-scoped cookie afterward. This fix covers the Google
SSO path only, since that's the reported and diagnosed path; the emergency-admin path is recorded
here as a known adjacent gap, not silently left undocumented.

## 2. The fix: session exchange

Rather than changing where the cookie is scoped (impossible without a shared parent domain, which
doesn't exist between two independent `*.vercel.app` projects) or relaying the raw session token
through the redirect URL (an unencrypted bearer credential in browser history/referrer/server
logs), `dashboard-api` now bridges the gap with a short-lived, single-use, opaque **exchange
code**, redeemed by `dashboard-web`'s own first-party route in a server-to-server call:

1. `GoogleAuthController#callback` still sets `dashboard-api`'s own session cookie (unchanged —
   still needed for direct browser-mediated `credentials: "include"` fetches to `dashboard-api`
   from mutation UIs). It then calls `SessionExchangeService#issue()` and redirects to
   `${WEB_APP_ORIGIN}/auth/exchange?code=...` instead of `WEB_APP_ORIGIN`'s bare root.
2. `dashboard-web`'s new `app/auth/exchange/route.ts` (the first Next.js Route Handler in this
   app) reads the code, `POST`s it to `dashboard-api`'s new `POST /auth/exchange` endpoint over a
   plain server-to-server `fetch()` (never browser-mediated), and on success sets its **own**
   first-party `wds_session` cookie from the result, then redirects to `/home`.
3. `SessionExchangeService#redeem()` deliberately mints a **second, independent session row** via
   the existing `SessionService.issue()` rather than trying to relay the original raw session
   token — raw tokens are never persisted anywhere (`session-token.ts`'s own doc comment; only
   their SHA-256 hash is), so the original can't be recovered to relay even if that were
   desirable. Both sessions are fully valid, independently revocable, and belong to the same user.

The exchange code itself follows the exact same security model as the existing session token
(`crypto/session-token.ts`, reused via import aliasing rather than duplicated):
`randomBytes(32).toString("base64url")`, SHA-256-hashed before storage, raw value never persisted.
It is single-use (`redeemed_at`) and short-lived (`SESSION_EXCHANGE_CODE_MAX_AGE_SECONDS`, default
60s, same order of magnitude as `OIDC_TRANSACTION_MAX_AGE_SECONDS`) — it only ever needs to survive
one top-level redirect hop. Redemption is an atomic conditional `UPDATE ... WHERE redeemed_at IS
NULL AND expires_at > now` (not a read-then-write check), mirroring
`IdempotencyKeyRepository.reserve()`'s own discipline — two concurrent redeem attempts for the same
code can never both succeed.

`POST /auth/exchange` deliberately carries no `OriginCheckGuard`/session-cookie requirement of its
own — it is authenticated purely by possession of the single-use code, the same trust model as a
password-reset token, and there is no browser-held cookie to check at that leg in the first place.

## 3. What exists

### Database (`packages/database`)

- **Migration `00046-create-session-exchange-codes.ts`** — `session_exchange_codes` table
  (`id`, `user_id` FK → `users` `ON DELETE CASCADE`, `auth_method` enum, `code_hash` unique
  `STRING(64)`, `expires_at`, `redeemed_at` nullable, `created_at`), indexed on `expires_at`.
- **`src/auth/entities.ts`** — `SessionExchangeCodeEntity`.
- **`src/auth/models.ts`** — `SessionExchangeCode` added to `AuthModels`.
- **`src/auth/session-exchange-code.repository.ts`** (new) — `create()`, and the atomic
  `redeem(codeHash, now)` described above.
- **`src/auth/index.ts`** — exports `SessionExchangeCodeRepository`. (Both `packages/database`
  barrels — `index.ts` and the separately-maintained `index.cjs.ts` — already re-export the whole
  `./auth/index.js` domain wholesale, so no second edit was needed there; see `CLAUDE.md`'s
  standing caution about that split before assuming a single barrel edit is ever enough.)

### Backend (`apps/dashboard-api`)

- **`auth/config/auth.constants.ts`** — `SESSION_EXCHANGE_CODE_REPOSITORY` DI token.
- **`auth/config/auth-env.ts`** — `SESSION_EXCHANGE_CODE_MAX_AGE_SECONDS` (15–300s, default 60).
- **`auth/database.providers.ts`** — provider wiring for the new repository token.
- **`auth/session/session-exchange.dto.ts`** (new) — `sessionExchangeSchema` (Zod, `{ code:
string().min(1) }`).
- **`auth/session/session-exchange.service.ts`** (new) — `SessionExchangeService`: `issue()` and
  `redeem()` as described in §2.
- **`auth/session/session.controller.ts`** — new `POST /auth/exchange` endpoint (`exchange()`),
  returning `{ sessionToken, expiresAt }` on success or a generic `400 BadRequestException` on an
  invalid/expired/already-redeemed code (no distinction surfaced to the caller, same
  no-user-enumeration discipline as the rest of this auth stack).
- **`auth/google/google-auth.controller.ts`** — `callback()`'s success path now issues an exchange
  code and redirects through `/auth/exchange` instead of straight to `WEB_APP_ORIGIN`.
- **`auth/auth.module.ts`** — registers `SessionExchangeService` as a provider (no new controller
  registration needed — `SessionController` was already registered).

### Frontend (`apps/dashboard-web`)

- **`lib/session-cookie.ts`** (new) — `SESSION_COOKIE_NAME = "wds_session"`, matching
  `dashboard-api`'s `SESSION_COOKIE_NAME` default. There is no shared config between the two
  deployments to enforce this at build time; the value is kept in sync by convention (the same
  hardcoded-constant pattern `CURRENT_PROJECT_COOKIE`/`E2E_SESSION_COOKIE_NAME` already use), and
  `dashboard-api`'s env var has never actually been overridden from its default in any recorded
  deployment.
- **`app/auth/exchange/route.ts`** (new) — the Route Handler described in §2: reads `code`, calls
  `POST /auth/exchange`, sets the first-party cookie (`httpOnly`, `secure`, `sameSite: "lax"` —
  correctly _first-party_ now, unlike `dashboard-api`'s own `SameSite=None` cookie, since this
  request never leaves `dashboard-web`'s own origin), and redirects to `/home`. Any failure
  (missing code, misconfigured `NEXT_PUBLIC_API_BASE_URL`, a network error, or a non-OK response
  from `dashboard-api`) redirects to the existing `/auth/error?reason=expired` page rather than
  inventing a new error page — logged server-side first via `console.error`, matching
  `server-session.ts`'s own `tryGetApiBaseUrl()`/`fetchProjectSummaries()` precedent of never
  letting a real misconfiguration disappear silently into an ordinary-looking redirect.

## 4. Validation

- **Unit**: `apps/dashboard-api/src/auth/session/session-exchange.service.spec.ts` (6, new,
  mocked repository/`SessionService`) — 369/369 `dashboard-api` unit tests passing.
  `apps/dashboard-web/tests/unit/auth-exchange-route.test.tsx` (6, new) — 140/140 `dashboard-web`
  unit tests passing.
- **Integration**: `packages/database/test/session-exchange.integration.test.ts` (5, new, real
  disposable database) — create/redeem, single-use enforcement, expiry enforcement, and an
  unknown-code lookup, plus a full migration up/down round-trip.
- **E2E**: `apps/dashboard-api/test/auth.e2e-spec.ts` gained a `POST /auth/exchange` suite (4 new,
  real disposable database) proving a redeemed code mints a genuinely independent, working second
  session (verified via a _separate_ `supertest` agent that never touched the original login
  cookie), single-use enforcement over real HTTP, and a generic `400` for an unknown/missing code.
  `apps/dashboard-api/test/google-auth.controller.e2e-spec.ts` gained a success-path test (1 new)
  proving a successful callback issues an exchange code and redirects to
  `${WEB_APP_ORIGIN}/auth/exchange?code=...` rather than the old bare-root redirect.
- Full monorepo validation: typecheck/lint/`next build`/`nest build`/`pnpm exec prettier --check`
  all clean across `packages/database`, `packages/shared-types`, `apps/dashboard-api`, and
  `apps/dashboard-web`.

## 5. Independent code review (2026-08-18)

This project's own `code-review` skill ran at high effort (8 finder angles, 1-vote verification
per candidate) against the full branch diff. All 11 candidates survived verification (10
CONFIRMED, 1 PLAUSIBLE); the PLAUSIBLE one (no cleanup job for expired-but-unredeemed
`session_exchange_codes` rows) was left out of the top-10 report as low-severity, precedented debt
(`IdempotencyKeyRepository` has the identical gap). All 10 reported findings were CONFIRMED; 9
were fixed, 1 was deliberately left as accepted debt:

- **Logout didn't revoke the session that actually gates the app.** Splitting one login into two
  independent sessions meant `dashboard-api`'s own `POST /auth/logout` (called via a browser
  `credentials: "include"` fetch) only ever revoked the rarely-used `dashboard-api`-side session —
  the `dashboard-web`-side session `getServerSession()` actually authenticates every `(shell)` page
  against was never touched. Fixed with a new `apps/dashboard-web/app/auth/session/route.ts`
  (`DELETE`), which forwards the whole incoming `Cookie` header (not a name-keyed lookup) to
  `dashboard-api`'s `/auth/logout` with an explicit `Origin` header (server-to-server calls set
  none by default, and `OriginCheckGuard` fails closed on a missing one), then clears the local
  cookie. `LogoutPage` now calls both endpoints via `Promise.allSettled`.
- **`GoogleAuthController#callback`'s exchange-code issuance was unguarded**, running _after_
  `setSessionCookie()` with no try/catch — a transient failure there would leave a valid session
  cookie staged on a raw, unstyled `500` response instead of the graceful `/auth/error` redirect
  every sibling failure path uses. Fixed by reordering (issue the code first, guarded) and setting
  the cookie only once issuance succeeds.
- **The actively-used session was stamped with the wrong `ipHash`/`userAgent`** — captured from
  the server-to-server `POST /auth/exchange` request (no forwarded client IP/user-agent) instead
  of the real browser request. Fixed by capturing `ipHash`/`userAgent` at `issue()` time (the real
  callback request) and storing them on the `session_exchange_codes` row itself (migration `00046`
  amended, not superseded, since it hadn't shipped anywhere yet — new `ip_hash`/`user_agent`
  columns) — `redeem()` now uses the stored values instead of re-deriving them.
- **No `auth_events` record for the session actually in use.** `SessionExchangeService#redeem()`
  called `SessionService#issue()` directly with no corresponding audit event, unlike every other
  session-issuing path in this codebase (`sso_login_succeeded`, `emergency_login_succeeded`).
  Fixed by adding a `session_exchange_redeemed` event type to the `AuthEventType` vocabulary,
  recorded in `redeem()` referencing the new session's id.
- **`POST /auth/exchange` has no `OriginCheckGuard`/shared secret** — protected only by the code's
  256-bit entropy, single-use redemption, and 60s TTL, and the code itself traverses a real,
  Vercel-logged URL (`GET /auth/exchange?code=...`) on every login. **Left as accepted, tracked
  debt** — closing it properly means either a POST-based redirect flow (a materially bigger
  architectural change for a narrow, ~60-second exploit window requiring near-real-time log
  access) or accepting the same shape every OAuth Authorization Code grant already accepts. Flagged
  explicitly for the required second-role reviewer's own judgment rather than silently accepted.
- **`response.json()` in the exchange route was unguarded**, unlike every sibling failure branch
  in the same function. Fixed with a try/catch redirecting to the same `/auth/error?reason=expired`
  page.
- **The cookie name `dashboard-web` writes under was a separately-hardcoded constant**, kept in
  sync with `dashboard-api`'s own `SESSION_COOKIE_NAME` env var purely by convention — the same
  shape as this project's own documented CJS-barrel-export production incident. Fixed by having
  `POST /auth/exchange`'s response echo back `cookieName` (`env.SESSION_COOKIE_NAME`); the route
  now writes the cookie under that value, not its own guess. `lib/session-cookie.ts`'s constant is
  now only a best-effort default for the new logout route's local cookie clear.
- **The new cookie hardcoded `secure: true`** with no override, unlike `dashboard-api`'s own
  `SESSION_COOKIE_SECURE`-driven equivalent — would silently drop the cookie in local dev (plain
  `http://localhost`). Fixed with an equivalent server-only `SESSION_COOKIE_SECURE` env read.
- **A redirect-to-error literal was duplicated 4 times** in the 77-line exchange route. Fixed by
  extracting a `redirectToAuthError()` helper.
- **`SessionExchangeCodeRepository#redeem()` did two DB round trips** (a conditional `UPDATE` then
  a separate `findOne`) where Sequelize's `returning: true` returns the updated row from the
  `UPDATE` itself. Fixed.

Re-validated after fixes: 7 new `dashboard-api` unit tests (`session-exchange.service.spec.ts`,
now 7), 2 new `packages/database` integration tests (`ip_hash`/`user_agent` round-trip and
default-null), 6 new `dashboard-api` e2e tests (`cookieName` echo, `ipHash`/`userAgent` stamping
from issue-time context, a logout-via-forwarded-cookie regression proving the new `/auth/session`
route's mechanism, and a guarded-`issue()`-failure regression), 3 new `dashboard-web` unit test
files (`auth-session-route.test.tsx`, `logout-page.test.tsx`, and expanded
`auth-exchange-route.test.tsx` coverage) — 370/370 `dashboard-api` unit tests, 143/143
`dashboard-web` unit tests, all passing; typecheck/lint/`next build`/`nest build`/
`pnpm exec prettier --check` all clean.

## 6. What this deliberately does not cover

- The emergency-admin TOTP login path has the identical underlying bug (§1) but is not fixed here
  — flagged as a known, separate, not-yet-authorized follow-up.
- No change to `dashboard-api`'s own session cookie, its `SameSite=None` setting, or
  `OriginCheckGuard` — all remain exactly as already reviewed and gated.
- `POST /auth/exchange`'s lack of an `OriginCheckGuard`/shared-secret guard (§5) — accepted,
  tracked debt, flagged explicitly for second-role review rather than silently left unaddressed.
- No production migration has been run yet — migration `00046` still needs the user to run
  `pnpm --filter @webdesk/database run migrate` themselves in their own terminal, per this
  project's standing credential-handling discipline, only after this branch is reviewed, gated,
  and merged.

## 7. Production incident (2026-08-19) and the error-masking fix

After PR #35 merged and migration `00046` ran, a real Google SSO sign-in attempted in the brief
window before the migration had actually landed failed with "Sign-in failed — Your sign-in
attempt expired. Please try again." Diagnosed directly from live Vercel runtime logs (via the
user's own authenticated Chrome session): `GoogleAuthController#callback` logged
`failed to issue session-exchange code`, a Postgres `42P01` (`undefined_table`) error on
`INSERT INTO "session_exchange_codes"` — the login raced the migration, not a defect in the
session-exchange code itself. The very next attempt (after the migration had genuinely landed)
completed successfully.

That diagnosis surfaced a real, separate design gap: every failure path in this flow — both
`GoogleAuthController#callback`'s `sessionExchange.issue()` catch block (`dashboard-api`) and
`dashboard-web`'s `/auth/exchange` route's `redirectToAuthError()` helper — redirected to
`/auth/error?reason=expired` regardless of the actual failure class. A genuine backend 500 (like
the incident above) showed the exact same message as an actually-expired code, which made the
incident briefly ambiguous before the logs settled it.

**Fixed** by splitting the taxonomy into two `reason` values, `expired` and `error`:

- `reason=expired` stays reserved for genuinely expired/invalid states: a missing OIDC transaction
  cookie (`GoogleAuthController#callback`'s pre-existing check, unchanged — this one really is an
  expiry), a missing `code` query param on `/auth/exchange`, and the backend's `400` response
  (`SessionController#exchange` throwing `BadRequestException("Invalid or expired exchange
code")` when `redeem()` returns `null`).
- `reason=error` now covers every other failure: `sessionExchange.issue()` throwing (the exact
  shape of this incident), a misconfigured `NEXT_PUBLIC_API_BASE_URL`, a network failure reaching
  `dashboard-api`, any non-`400` non-2xx status, and a malformed response body.

`apps/dashboard-web/app/auth/error/page.tsx`'s `REASON_MESSAGES` gained an explicit `error` entry
(`"Something went wrong while signing you in."`, matching the existing `DEFAULT_MESSAGE` text) so
the mapping stays self-documenting rather than relying on an unrecognized-reason fallback. No
change to the underlying rejection semantics for genuinely expired/invalid cases, and no change to
`dashboard-api`'s session cookie, `SameSite`, or `OriginCheckGuard` — this is a diagnostics-only
fix (which message the user sees, and what gets logged), not a behavior change to what succeeds or
fails.

Validated: 370/370 `dashboard-api` unit tests, 111/111 `dashboard-api` e2e tests (real disposable
database, including the updated `GoogleAuthController` regression test now asserting
`reason=error`), 143/143 `dashboard-web` unit tests (including 3 tests changed from asserting
`reason=expired` to `reason=error` for the misconfiguration/network-failure/non-400-status/
malformed-body cases, and one left unchanged for the genuine 400 case), typecheck/lint/
`next build`/`nest build`/`pnpm exec prettier --check` all clean.

## 8. Shared-type fix for the reason taxonomy (2026-08-19)

PR #36's own second-role review accepted, as tracked debt, that the `expired`/`access_denied`/
`error` taxonomy §7 introduced was still declared independently in two places — a local
`AuthErrorReason` type in `dashboard-web`'s `/auth/exchange` route, and bare untyped string
literals in `dashboard-api`'s `GoogleAuthController` — with no compiler tie between the two apps.
That's the exact structural shape (two independently-deployed apps agreeing on a value by
convention only) that let the original masking bug happen in the first place.

**Fixed** by promoting a single `AuthErrorReason` type into `packages/shared-types` (all three
values: `expired` | `access_denied` | `error`), matching the existing precedent this monorepo
already has for cross-app-consistent literal unions (`AuthMethod`, `HealthStatus`,
`SessionRevocationReason`) and this same feature's own earlier `cookieName` echo-back pattern:

- `GoogleAuthController` now imports the shared type and routes all three redirects through a new
  private `redirectToAuthError(res, reason: AuthErrorReason)` helper, instead of three separate
  hand-written template strings.
- `dashboard-web`'s `/auth/exchange` route imports the shared type instead of declaring its own
  local copy; `redirectToAuthError()`'s signature and behavior are otherwise unchanged.
- `dashboard-web`'s `/auth/error` page now types `REASON_MESSAGES` as `Record<AuthErrorReason,
string>` (not `Record<string, string>`) — TypeScript will refuse to compile this file if a reason
  is ever added to the shared union without a matching message here, closing the "future reason
  silently falls through to the generic message" risk the shared-type review flagged. Since
  `reason` itself is still untrusted input from `searchParams`, indexing is done through a new
  `isKnownReason()` type guard rather than a direct index, preserving the existing safe-fallback
  behavior for an unrecognized value.

No behavior change for any real request — this is a type-safety-only refactor. Validated:
370/370 `dashboard-api` unit tests, 111/111 `dashboard-api` e2e tests (real disposable database),
143/143 `dashboard-web` unit tests, `dashboard-worker` typecheck (a third, unrelated consumer of
`packages/shared-types`, confirmed unaffected), typecheck/lint/`next build`/`nest build`/
`pnpm exec prettier --check` all clean across `packages/shared-types`, `apps/dashboard-api`, and
`apps/dashboard-web`.

### 8a. Independent code review (2026-08-19)

High effort (8 finder angles, 1-vote verification) on branch `fix-auth-error-reason-shared-type` —
7 candidates survived dedup, 2 CONFIRMED, 3 PLAUSIBLE, 2 REFUTED. Both CONFIRMED findings fixed:

- **`isKnownReason()`'s `value in REASON_MESSAGES` walked the object's prototype chain.** A
  `reason` value matching an inherited `Object.prototype` key (`constructor`, `toString`, etc.)
  passed the guard, and `REASON_MESSAGES[reason]` then resolved to the inherited function value —
  rendered as `{message}` in JSX, React throws ("Functions are not valid as a React child"),
  crashing the one page whose job is to fail gracefully. `/auth/error` is public and unauthenticated
  (`?reason=constructor` needs no login flow to reach). Pre-dated this branch (the old
  `REASON_MESSAGES[reason]` bracket lookup had the identical hole), but this branch is what touched
  this exact code and wrapped it in a function that reads as an authoritative safety guard without
  actually closing it. **Fixed** with `Object.hasOwn(REASON_MESSAGES, value)` instead of `in`.
- **The unknown-reason fallback logged nothing.** `AuthErrorReason` only guarantees agreement
  between `dashboard-api` and `dashboard-web` at the same commit — the two are independently-
  deployed Vercel projects with independent deploy timing (this project has real precedent for that
  gap, e.g. Phase 1E's migrations landing ~1.5 days after their gated merge). If a future reason
  value is ever added and one app redeploys before the other, a real user in that window would hit
  a reason value the other app's build doesn't recognize — and it would silently show
  `DEFAULT_MESSAGE` with zero signal, reproducing the exact "invisible until someone digs through
  raw Vercel logs" cost of the original 2026-08-19 incident. **Fixed** with a `console.error` on the
  unrecognized-reason fallback path (only when `reason` is present and unrecognized — not on every
  ordinary "no reason" render).

3 PLAUSIBLE findings left open, not fixed (per the "fix the confirmed findings" instruction): a
narrow behavior change for `reason=""` (blank message → generic message; only reachable via a
hand-typed URL, no real caller ever sends an empty string, and the new behavior is strictly better);
a `redirectToAuthError` name collision between the new `dashboard-api` controller method and the
pre-existing `dashboard-web` route function (different signatures, different runtimes, both files'
doc comments already cross-reference each other); and the same incident-narrative explanation
restated across all 4 changed files' doc comments (real but low-severity — each also carries
genuinely distinct local context, closer to normal per-usage-site documentation than harmful
duplication). 2 findings were REFUTED: widening `dashboard-web`'s route-local `AuthErrorReason`
from 2 values to 3 (an acceptable, even necessary side effect of the actual fix — a narrower local
subtype would just recreate the duplication this branch exists to eliminate); and the new
`redirectToAuthError` being a private class method rather than a standalone function (the more
idiomatic NestJS pattern here, given it needs `this.env`).

Added a new `apps/dashboard-web/tests/unit/auth-error-page.test.tsx` (6 tests) covering both fixes
directly — the generic/no-reason path, each known reason's specific message, an unrecognized reason
falling back to the generic message while logging exactly once, and the `constructor` prototype-key
case specifically. Re-validated: 149/149 `dashboard-web` unit tests (6 new), typecheck/lint/
`next build`/`pnpm exec prettier --check` all clean.
