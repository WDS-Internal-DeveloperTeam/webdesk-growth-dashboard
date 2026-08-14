# Phase 1F — Performance Baseline (as-built)

**Status:** Records what was actually measured, and states plainly what was not, for the
application shell built this phase. This project's honesty discipline applies here as much as
anywhere: no synthetic Lighthouse score or load-test number is invented for a shell that has never
run in front of real traffic beyond a single real signed-in user.

## 1. What exists to measure

`dashboard-web`'s real, production-deployed pages as of this phase: `/auth/sign-in`, `/health`,
`/home` (the new shell landing page), and the not-found/error boundaries. `dashboard-api`'s real
endpoints: the pre-existing auth/session/RBAC surface, plus this phase's `GET /me` and `GET
/me/navigation`.

## 2. Real measurements taken

- **Local production build succeeds and completes in a normal timeframe** — `pnpm build` (Turborepo,
  all packages) was run repeatedly throughout this phase as part of standard validation; no build
  ever took an anomalous amount of time or produced a build-time warning about bundle size.
- **`GET /me/navigation`'s real query shape**: `NavigationService.getNavigation()` issues exactly 3
  queries per request, run in parallel via `Promise.all` — `moduleRegistry.listForNavigation()`
  (43 rows), `modules.listAll()` (21 rows), and `AuthorizationService.getEffectiveCapabilities()`
  (the pre-existing Phase 1D-expanded capability resolution, unchanged here). All three are small,
  indexed reads against tables with a small, fixed row count (43 and 21 rows respectively, neither
  of which grows with user count or request volume) — there is no N+1 pattern and no per-row
  database round-trip.
- **`dashboard-web`'s Playwright smoke suite** (`tests/e2e/smoke.spec.ts`,
  `tests/e2e/accessibility.spec.ts`) completes in under 5 seconds locally against a real `next dev`
  server for 8 tests — not a load/performance benchmark, but confirms no page in the reachable-
  without-a-session set has an obvious render-blocking issue.

## 3. What was explicitly NOT measured, and why

- **No Lighthouse/Core Web Vitals run** — would require a stable, publicly reachable URL serving
  representative content; `/home` currently renders to a single real user, and running Lighthouse
  against production for a page with real user traffic (however minimal) without a specific reason
  wasn't undertaken this phase. Recommended before this shell handles meaningfully more traffic.
- **No load/stress test against `GET /me/navigation` or `GET /me`** — no real multi-tenant traffic
  exists yet (single real Super Admin user, per `CLAUDE.md`'s "Current state"); a load test against
  a system with no real concurrent-user baseline to compare against would produce a number with no
  meaningful interpretation.
- **No bundle-size budget or tracking** — `next build`'s own build-time output was watched for
  obvious regressions during this phase's iterative validation, but no formal budget/threshold was
  set or enforced in CI. Worth adding once the shell has more real pages to budget against.
- **No database query timing beyond the qualitative shape analysis in §2** — no APM/tracing tool is
  wired into this project yet; timing numbers from a local disposable database aren't representative
  of production Neon latency and would be misleading if reported as a "baseline."

## 4. Recommendation for a future, real performance baseline

Once real multi-user traffic exists (beyond the single Super Admin account) and at least a handful
of the 43 modules have real pages to measure, run: (a) Lighthouse/Core Web Vitals against the real
production URL for `/home` and 2-3 representative module pages, (b) a light load test against
`GET /me/navigation` (the one endpoint every authenticated page load depends on) to establish a
real p50/p95 latency number, and (c) set a `next build` bundle-size budget in CI once there's
enough real page content to make one meaningful. None of this is actioned by this document — it is
a recommendation for whoever picks up the next phase of work, not a task this phase executed.
