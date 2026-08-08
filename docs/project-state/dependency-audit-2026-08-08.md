# Dependency Audit — 2026-08-08

**Trigger:** explicit user authorization to attempt the three major-version bumps
`docs/project-state/dependency-audit-2026-08-07.md` had deferred: Next.js 15.x → 16.x, NestJS
10.x → 11.x, Vitest 2.x → 3.x. This document records that work.

## Before

```
$ pnpm audit
19 vulnerabilities found
Severity: 10 moderate | 8 high | 1 critical
```

(One more than the 18 recorded on 2026-08-07 — an additional PostCSS advisory landed in the
interim; never separately re-triaged until now.)

## What was fixed

### 1. Next.js `15.5.22` → `16.3.0` (`apps/dashboard-web` only)

Resolves the `postcss` + `sharp` group. Confirmed before upgrading that no patch existed within
the 15.x line at all — `next@15.5.23` (the newest 15.x release) still pins `postcss@8.4.31`
(vulnerable); only `16.3.0` bumps it to `8.5.23` (patched, advisory requires `>=8.5.18`) and
`sharp` to `^0.35.3`.

Validated: production build (Turbopack, Next 16's new default) clean; `tsc --noEmit` clean;
`eslint` clean; unit tests (1/1) and the full Playwright e2e suite (4/4, including the
security-headers check against `next.config.ts`'s `headers()` function) all pass. `pnpm why
postcss`/`pnpm why sharp` confirm the patched versions actually resolved, not just that install
succeeded.

### 2. NestJS `10.4.x` → `11.1.28` (`apps/dashboard-api` only)

Resolves the `multer` + `file-type` + `@nestjs/core`'s own CVE group — none had a patch anywhere
in the 10.x line. This bump bundles **Express `4.x` → `5.2.1`**, itself a breaking change
(`path-to-regexp` v8's stricter route-pattern syntax, several deprecated Express 4 APIs removed).
Before attempting: audited every route decorator in the codebase (all plain static segments or
simple named `:param`s, no wildcards, no optional-param `?` syntax) and grep'd for deprecated
Express 4-only APIs (`req.param()`, `app.del()`, `res.send(number)`) — none found. Confirmed
`@nestjs/swagger@11`, `@types/express@5`, and `cookie-parser` were all compatible before
upgrading.

Validated: `nest build` and `tsc --noEmit` clean; unit tests (115/115, though these construct
services directly with `new`, bypassing Nest's DI container, so they don't actually exercise
`emitDecoratorMetadata`); **the real-database e2e suite (28/28)**, which boots a real Nest app via
`@nestjs/testing`'s `Test.createTestingModule().compile()` — the actual DI container that resolves
constructor parameters by type reflection — is the meaningful proof here: a broken
`emitDecoratorMetadata` would produce near-immediate `TypeError`s across nearly every one of those
28 tests, not a silent pass. `pnpm why multer` confirms `2.2.0` (patched) resolved.

### 3. Vitest `2.1.x` → `3.2.7` (all 9 packages)

Resolves the critical Vitest-UI-arbitrary-file-read finding plus 3 `vite` findings — advisory
required `vitest >=3.2.6`, `vite >=6.4.3`. Deliberately targeted the latest **3.x** release
(`3.2.7`), not the newest overall release (`4.1.10` was available) — the minimal version that
fixes the advisory carries far less risk than also adopting an unreleased-feature major line, and
this project's `apps/dashboard-api` has fragile custom `unplugin-swc`/`@swc/core` wiring
specifically built around Vitest 2/3's transform pipeline (NestJS's own documented fix for
`emitDecoratorMetadata` under Vitest — esbuild, Vitest's default transform, doesn't emit it).
Confirmed compatible versions existed before bumping: `unplugin-swc@1.5.10` (already latest,
Vite-version-agnostic) and `@vitejs/plugin-react@4.7.0` (already installed, peer-range
`^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0` already covers Vite 6) — neither needed its own bump.

**A real gap found during this bump, not assumed away:** `vitest@3.2.7`'s own `vite` dependency
range (`^5.0.0 || ^6.0.0 || ^7.0.0-0`) is broad enough that pnpm's resolver kept the
already-present, unpatched `vite@5.4.21` rather than picking a patched `6.x` release — bumping
`vitest` alone left the `vite` advisories unresolved. Added a bounded
`pnpm-workspace.yaml` override (`vite: '>=6.4.3 <7.0.0'`) to force it; re-verified `pnpm why vite`
resolves to a single `6.4.3` afterward, and the full test suite still passes.

Validated (same discipline as above, run twice — once after the raw `vitest` bump, again after
adding the `vite` override): full monorepo `build`/`lint`/`typecheck`/`test` (14/14 tasks each
run); `dashboard-api`'s real-database e2e suite (28/28) — the critical proof that
`emitDecoratorMetadata` still works under the new transform pipeline, for the same reason as
NestJS above; `packages/database`'s real-database integration suite (35/35);
`dashboard-web`'s Playwright suite (4/4, confirming `@vitejs/plugin-react` + the new `vite` still
render correctly).

### 4. `uuid` override (`8.3.2` → `11.1.1`) — found during this pass, not part of the original plan

While re-triaging the audit output, a `uuid@8.3.2` finding surfaced that wasn't part of the
original three-bump plan: `sequelize@6.37.8` pins `uuid@8.3.2` internally, and — same pattern as
`multer`/`postcss` above — no patch exists anywhere in the 8.x line (patched only `>=11.1.1`).
Before overriding: read `sequelize`'s own source to confirm exactly which `uuid` functions it
calls (`v1`, `v4` only — both stable, unchanged functions across `8.x`–`11.x`) rather than assuming
compatibility. Added a bounded override (`uuid: '>=11.1.1 <12.0.0'`); `apps/dashboard-api` already
depended on `uuid@11.1.1` directly, so this also collapses the workspace to a single resolved
`uuid` version instead of two. Re-ran `packages/database`'s full real-database test suite (which
exercises every entity's UUID-primary-key generation, i.e. `sequelize`'s own `uuid.v4()` call, on
every single row created) — 19 unit + 35 integration, all passing.

## After

```
$ pnpm audit
No known vulnerabilities found
```

**19 → 0.** Every finding from the 2026-08-07 baseline (plus the one that had accumulated since)
is resolved — not deferred, not accepted-risk, actually fixed and re-verified against real tests
at every step. This includes `ajv` — the one finding the 2026-08-07 pass explicitly left
unpatched (a blanket override broke ESLint's own bundled `ajv`) — resolved as a side effect of the
`@nestjs/cli` `10.x` → `11.x` bump: it pulls a newer `@angular-devkit` chain
(`@angular-devkit/core@19.2.24`/`19.2.27`) whose own `ajv-formats`→`ajv` path no longer resolves to
the vulnerable version. Confirmed via `pnpm why ajv` — the `@angular-devkit` chain is still
present, but the specific advisory no longer matches what it resolves to.

## What this document does not claim

Every mitigation above was verified by actually running the relevant test suite after each
change — including, critically, real-database e2e suites that exercise NestJS's actual DI
container (not just unit tests that bypass it via `new`) — not asserted from a clean `pnpm install`
or a passing `tsc` alone. It does **not** claim the Express 5 migration has been exercised against
every possible route pattern this project might use in the future (only the routes that exist
today, all simple `:param` patterns); a future route using wildcard or optional-param syntax would
need its own compatibility check against `path-to-regexp` v8's syntax.
