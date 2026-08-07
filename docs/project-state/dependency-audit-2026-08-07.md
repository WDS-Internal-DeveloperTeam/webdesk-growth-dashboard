# Dependency Audit — 2026-08-07

**Trigger:** `pnpm audit`, run by the `dependency-audit` job in `.github/workflows/ci.yml`.
That job is `continue-on-error: true` for Phase 1A ("surfaced for visibility, not yet gating
merges" — see the CI workflow's own comment), so this did not block anything, but the findings
(35 vulnerabilities, including 1 critical) were worth triaging rather than leaving unexamined.

## Before

```
$ pnpm audit
35 vulnerabilities found
Severity: 4 low | 16 moderate | 14 high | 1 critical
```

## What was fixed

Nine targeted `pnpm-workspace.yaml` `overrides` — each bumps a transitive dependency to a patched
version, bounded to stay within the same major line it already resolved to (an unbounded `>=`
range is not safe: it let `glob` jump `10.x → 13.x` and `body-parser` jump `1.x → 2.x` on the
first attempt, both caught only by re-running the full validation suite afterward, not by reading
the override itself):

| Package       | Before              | Override                      | After     |
| ------------- | ------------------- | ----------------------------- | --------- |
| `glob`        | `10.4.5`            | `>=10.5.0 <11.0.0`            | `10.5.0`  |
| `picomatch`   | `<4.0.4`            | `>=4.0.4 <5.0.0`              | `4.0.5`   |
| `tmp`         | `<0.2.6`            | `>=0.2.6 <0.3.0`              | `0.2.7`   |
| `esbuild`     | `<=0.24.2`          | `>=0.25.0 <0.26.0` (see note) | `0.25.12` |
| `webpack`     | `<5.104.1`          | `>=5.104.1 <6.0.0`            | `5.109.2` |
| `js-yaml`     | `4.17.21`-class     | `>=4.3.1 <5.0.0`              | `4.3.1`   |
| `lodash`      | `4.17.21`           | `>=4.17.24 <5.0.0`            | `4.18.1`  |
| `qs`          | `~6.14.0`           | `>=6.15.2 <7.0.0`             | `6.15.3`  |
| `body-parser` | `~1.20.3`/`~1.20.5` | `>=1.20.6 <2.0.0`             | `1.20.6`  |

**Note on esbuild:** the advisory's "patched versions >=0.24.3" doesn't correspond to a real
published release — esbuild's `0.24.x` line stops at `0.24.2`; the fix only landed starting at
`0.25.0`. The override target was corrected to `>=0.25.0 <0.26.0` after the first install attempt
failed with `ERR_PNPM_NO_MATCHING_VERSION`.

All nine bumps were re-validated after installing, not assumed safe from the override text alone:

- `turbo run typecheck lint test build` — 36/36 tasks, clean.
- `pnpm boundaries:check` — 0 errors (same 2 pre-existing orphan warnings as before).
- `pnpm scan:secrets` — 187 tracked files, clean.
- `pnpm format` — clean.
- `dashboard-api` integration tests (5/5) and `dashboard-web` Playwright smoke tests (4/4) —
  re-run directly, not just the unit-test layer.
- `pnpm --filter @webdesk/dashboard-api dev` — started cleanly and served `/health` correctly,
  confirming the `nest-cli.json` `deleteOutDir` fix from earlier in Phase 1A still holds with the
  updated `webpack`/`glob`/`tmp`/`picomatch` versions (all reached via `@nestjs/cli`'s build
  pipeline).

## After

```
$ pnpm audit
18 vulnerabilities found
Severity: 9 moderate | 8 high | 1 critical
```

All 4 "low" findings are gone. The remaining 18 fall into four groups, none of them safely
fixable by an override — each requires either accepting a version pinned by a framework we don't
control, or a deliberate version-line decision:

### 1. `multer` (4 findings) + `file-type` (2 findings) + `@nestjs/core`'s own CVE (1 finding)

All three are exact-pinned or version-capped inside `@nestjs/core`/`@nestjs/platform-express`
`10.4.22` (confirmed by reading those packages' own `package.json` — `multer: "2.0.2"`,
`file-type: "20.4.1"`, both exact pins, not ranges). `10.4.22` is the newest `10.x` NestJS
release available (checked against the npm registry) — **no patched version exists anywhere in
the 10.x line**. The fix requires NestJS `11.x`. This is a real major-version decision, not
something to force via override — NestJS was an approved architecture choice (ADR-0002/0003),
and jumping a major version carries real regression risk against Phase 1A's carefully-tuned
NestJS/Pino/Zod/Vitest-DI setup. **Deferred, not decided here.**

Real-world exposure today: **very low**. This project has no file-upload endpoint anywhere
(`multer` is bundled by the framework, not invoked by any of our code), and no `ParseFilePipe`/
`FileTypeValidator` usage exists either.

### 2. `postcss` (4 findings) + `sharp` (1 finding)

Both pinned/ranged by `next@15.5.22` (`postcss` at an exact `"8.4.31"`, `sharp` at `"^0.34.3"`).
`15.5.22` is the newest stable Next.js 15 release (only `15.6.0-canary.*` builds exist beyond
it). Fixing these requires a Next.js major-version bump. **Deferred, not decided here.**

Real-world exposure today: **low**. All CSS processed by `postcss` is this project's own
`globals.css` (Phase 1A), not attacker-controlled input; `sharp`'s libvips CVEs require processing
an attacker-supplied image, and no image-upload/processing path exists yet.

### 3. `ajv` (1 finding)

A blanket `ajv` override was tried and reverted — it broke ESLint's own bundled `ajv` (`TypeError:
Cannot set properties of undefined (setting 'defaultMeta')`, since `@eslint/eslintrc` depends on
a specific `ajv` API surface). pnpm's scoped-selector syntax
(`@angular-devkit/core>ajv-formats>ajv`) doesn't support the multi-hop parent chain this specific
path needs. **Left unpatched.**

Real-world exposure: **very low** — dev/build-tool-only (`@nestjs/cli`'s `@angular-devkit`
dependency chain), moderate severity, and only exploitable if the vulnerable `$data` schema
option is fed attacker-controlled input, which no code path in this repo does.

### 4. `vitest`/`vite` (the 1 critical + 3 more)

Requires `vitest` `2.x → 3.x` — the same fragile setup this session already spent real effort
getting right (`unplugin-swc`/`@swc/core` wired into `vitest.config.mts` specifically to make
NestJS's decorator-metadata-based DI work under Vitest's esbuild transform). A major-version bump
here risks silently breaking that DI wiring in a way that might not be caught by every test.
**Deferred, not decided here.**

Real-world exposure today: **effectively zero**. The critical finding requires the Vitest UI
server to be actively listening (`vitest --ui`). Every test script in this repo uses `vitest run`
— the UI server is never started anywhere in this project's dev workflow or CI.

## What this document does not claim

This is a triage record, not a claim that the remaining 18 findings are permanently acceptable.
Two genuine version-line decisions are outstanding (NestJS `10.x → 11.x`, Vitest `2.x → 3.x`) and
should be made deliberately, with their own review and full-suite re-validation, not folded into
this maintenance pass.
