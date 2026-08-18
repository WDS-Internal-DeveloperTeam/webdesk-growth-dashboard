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

## 5. What this deliberately does not cover

- The emergency-admin TOTP login path has the identical underlying bug (§1) but is not fixed here
  — flagged as a known, separate, not-yet-authorized follow-up.
- No change to `dashboard-api`'s own session cookie, its `SameSite=None` setting, or
  `OriginCheckGuard` — all remain exactly as already reviewed and gated.
- No production migration has been run yet — migration `00046` still needs the user to run
  `pnpm --filter @webdesk/database run migrate` themselves in their own terminal, per this
  project's standing credential-handling discipline, only after this branch is reviewed, gated,
  and merged.
