# Phase 1F — Observability Foundation (as-built)

**Status:** Records what was actually built for brief §19–§24 — structured logging with redaction,
Sentry per-environment config, correlation/request IDs, safe error context, environment/version
metadata.

## 1. Correlation IDs — already existed, verified not re-invented

`apps/dashboard-api/src/common/correlation-id.middleware.ts` predates Phase 1F (built in Phase
1A). Every request gets a correlation ID — reused from an incoming `x-correlation-id` header if
the caller (e.g. `dashboard-web`) already set one, otherwise generated via `uuidv4()` — echoed
back on the response header and attached to `AllExceptionsFilter`'s error responses. Applied
globally via `app.module.ts`'s `consumer.apply(CorrelationIdMiddleware).forRoutes("*")`. Phase 1F
did not modify this — confirmed it already satisfies brief §22 rather than building a duplicate
mechanism.

## 2. Structured logging with redaction (`packages/configuration/src/logging.ts`)

`buildLoggerOptions()` was pre-existing (Phase 1A); Phase 1F extended `DEFAULT_REDACT_PATHS`,
closing real gaps against brief §20's explicit category list — matched against **actual field
names used in this codebase**, not generic guesses:

| Category                     | Path(s) added                                    | Real field this matches                                                       |
| ---------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| Tokens / session identifiers | `*.rawToken`                                     | `session.service.ts`/`google-auth.service.ts`'s real session-token field      |
| TOTP secrets                 | `*.totpSecret`, `*.totpSecretEncrypted`          | Redacted even encrypted — ciphertext has no business appearing in logs either |
| OAuth secrets                | `*.clientSecret`, `*.GOOGLE_OAUTH_CLIENT_SECRET` | The real Google OAuth client secret env var name                              |
| SMTP credentials             | `*.smtpPassword`, `*.SMTP_PASSWORD`              | Pattern-ready — no real SMTP integration is wired yet (WDS-004)               |
| Secret environment values    | `*.TOTP_ENCRYPTION_KEY`                          | Joins the pre-existing `*.DATABASE_URL`                                       |

Pino's `fast-redact` `*.fieldName` wildcard matches an exact key name one level down from any
object — **not** a substring or deep search — so every path above was verified against a real
field name actually used somewhere in this codebase, not a category label that happens to sound
right but would never match anything.

`packages/configuration/src/logging.test.ts` (new) asserts every category from brief §20 is
present by name. `apps/dashboard-api/src/app.module.ts`'s own `LoggerModule.forRoot()` call
extends this base list further with request-shape-specific paths (`req.headers.cookie`,
`res.headers["set-cookie"]`, `req.body.password`, `req.body.code`) — unchanged by Phase 1F, still
correct.

## 3. Build/release metadata (`packages/configuration/src/build-metadata.ts`, new)

`getBuildMetadata(version)` returns `{version, commitSha, commitShaShort, environment,
deploymentId, processStartedAt}`, sourced from Vercel's own auto-injected env vars
(`VERCEL_GIT_COMMIT_SHA`, `VERCEL_ENV`, `VERCEL_DEPLOYMENT_ID`) with `"unknown"` fallbacks outside
Vercel — never a fabricated value. `processStartedAt` is computed **once, at module load**
(`new Date().toISOString()` outside the function body), not per-call — an earlier draft computed
it inside the function and called it `buildTimestamp`, which would have silently returned the
current request time on every call while implying it was the actual build time. Caught and fixed
before any test was written, and the field renamed to honestly describe what it actually measures
(process start, the closest real proxy available — Vercel exposes no true build timestamp via env
var).

Wired into:

- **`GET /health` and `GET /ready`** (`apps/dashboard-api/src/health/health.controller.ts`) — a
  new optional `build` field on `HealthCheckResult` (`packages/shared-types`), additive so no
  existing consumer breaks.
- **The request logger's `base` object** (`apps/dashboard-api/src/app.module.ts`) — every log line
  now carries `environment`, `version`, and `commitSha` (short form) alongside the pre-existing
  `service` field.

## 4. Sentry (brief §19, §21) — mechanism built, deliberately inert

No real Sentry project or DSN exists for this project (not in
`docs/project-state/setup-input-register.md` before this work, now recorded there as an open item
by this slice). Building this "for real but pointed nowhere" follows the same pattern already
established by `NotificationsModule`'s `UnconfiguredNotificationDeliveryAdapter` (Phase 1E) — the
integration is real, tested code, not a stub comment, but genuinely never sends anything until
configured:

- **`packages/configuration/src/sentry.ts`** — `getSentryConfig({dsn, environment, release})`
  returns a plain data object (`enabled: Boolean(dsn)`), no dependency on the `@sentry/*` SDK
  itself — same separation `buildLoggerOptions` keeps from Pino.
- **`apps/dashboard-api/src/observability/sentry.ts`** — `initSentry(dsn)` calls the real
  `@sentry/node` SDK's `Sentry.init()` only when `getSentryConfig().enabled` is true;
  `captureException()` is a no-op until `initSentry()` has actually enabled it.
- **Wired into both entrypoints** — `apps/dashboard-api/src/main.ts` (local dev/CI) and
  `apps/dashboard-api/api/index.ts` (the real Vercel Function bootstrap) both call
  `initSentry(env.SENTRY_DSN)` before constructing the Nest app.
- **`AllExceptionsFilter`** calls `captureException(exception)` only for 5xx-class responses — an
  expected 4xx `HttpException` (validation failure, not-found, etc.) is normal traffic, not an
  incident worth an event.
- **`SENTRY_DSN`** added as an optional field to `baseEnvSchema` (`packages/configuration/src/env.ts`),
  validated as a URL when present, `undefined` by default — never a placeholder/test DSN.

Verified end-to-end without a real DSN: `initSentry(undefined)` never calls the real SDK's
`Sentry.init()` (mocked-SDK unit test); the compiled CommonJS build was rebuilt and executed
directly (`node -e "require('./dist/observability/sentry.js').initSentry(undefined)"`) to confirm
it doesn't crash under the exact module-resolution path Vercel's Function bundler actually uses —
the same class of check `CLAUDE.md`'s standing "Cautions" section calls out repeatedly (past ESM/
CJS bundling bugs in this project were caught only by exercising the real compiled output, never
by typecheck/lint/unit tests alone).

## 5. What was deliberately not built

- No real Sentry event has ever been sent — by design, until a real project/DSN exists (tracked in
  `docs/project-state/setup-input-register.md`).
- No log-shipping/aggregation service — Vercel's own runtime log viewer remains the only place
  these structured logs are actually read, same as every prior phase.
- No client-side (browser) error tracking in `dashboard-web` — this slice covers `dashboard-api`
  only; a `@sentry/nextjs` integration for the frontend is a separate, not-yet-requested piece of
  work, deliberately not bundled into this DSN-less slice.
