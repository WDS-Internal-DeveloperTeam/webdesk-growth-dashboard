# Phase 1B Validation Report — Database Foundation

**Status:** Real, reproducible command output captured below, following the same discipline as
`docs/project-state/phase-1a-validation-report.md` — nothing here is narrated or summarized
without the underlying command actually being run.

**Environment:** Node.js 24.19.0, pnpm 11.20.0. No Docker available in this environment — the
disposable test database used throughout was a local PostgreSQL 17.10 (Homebrew), not a
container. CI uses a `postgres:16` service container instead (`.github/workflows/ci.yml`); both
are exercised by the same test suite and neither is the actual chosen Marketplace provider
(Supabase) — see `docs/task-packages/phase-1b-database-foundation.md` §18.

## 1. Scope actually implemented (matches the approved task package)

- `packages/database/src/connection.ts` — real `getConnection()`: Sequelize instance, cached at
  module scope, serverless-aware pool sizing, SSL required by default (one carved-out exception:
  `DATABASE_SSL=false` for disposable local/CI test databases only).
- `packages/database/src/env.ts` — `databaseEnvSchema` (Zod), `DATABASE_URL` + pool-sizing
  variables.
- `packages/database/src/transaction.ts` — `withTransaction()`, a thin wrapper around Sequelize's
  managed-transaction API.
- `packages/database/src/migrate.ts` + `src/migrations/00001-create-framework-probe.ts` —
  umzug-based migration runner, one migration proving the framework (a `_framework_probe` table,
  explicitly not `projects`/`users`).
- `packages/database/src/base-repository.ts` — `SequelizeRepository<TEntity>`, a generic
  Sequelize-backed implementation of the Phase 1A `Repository<TEntity>` interface.
- `packages/database/src/health.ts` — `checkDatabaseHealth()`, a real `SELECT 1` round-trip.
- `packages/database/test/database-foundation.integration.test.ts` — exercises all of the above
  together against a real disposable database.
- `packages/database/README.md`, `.env.example` — local setup instructions.
- `.github/workflows/ci.yml` — new `database-migration-test` job, `postgres:16` service container.
- `packages/configuration/src/logging.ts` — three new redact-path patterns for
  connection-string-shaped fields.

**Not implemented** (per the task package's explicit two-tier authorization gate, §9/§24): the
`projects` and `users` entities. `_framework_probe` proves the framework mechanically; no real
business entity was created.

## 2. Dependencies installed

```
sequelize ^6.37.0, pg ^8.22.0, pg-hstore ^2.3.4, umzug ^3.8.0, zod ^3.24.0  (prod)
@types/pg ^8.20.0  (dev)
@webdesk/configuration workspace:*  (new internal dependency, for loadEnv reuse)
```

Resolved versions: `sequelize@6.37.8`, `pg@8.22.0`, `pg-hstore@2.3.4`, `umzug@3.8.3`. No
build-script approval gate triggered (`pnpm install` completed without an
`ERR_PNPM_IGNORED_BUILDS` prompt).

## 3. Full monorepo validation suite

```
$ pnpm install
Already up to date. Done in 183ms.

$ turbo run typecheck lint test build --force
 Tasks:    36 successful, 36 total
```

(One transient failure on `@webdesk/dashboard-web#typecheck` occurred on an earlier run of this
exact command — re-running `tsc -p tsconfig.json --noEmit` directly inside `apps/dashboard-web`
showed zero errors, and a full retry of the `turbo run` command passed 36/36. Treated as a
turbo-scheduling flake, not a real regression, and reproduced clean twice after.)

```
$ pnpm boundaries:check
  warn no-orphans: apps/dashboard-web/tests/unit/setup.ts
  warn no-orphans: apps/dashboard-web/lib/logger.ts
x 2 dependency violations (0 errors, 2 warnings). 80 modules, 99 dependencies cruised.
```

Zero errors — same two pre-existing, already-explained orphan warnings as every prior phase's
validation report. `only-database-package-touches-sequelize` (the rule that is now live, not a
no-op, for the first time) holds: `sequelize` is imported nowhere outside `packages/database`.

```
$ pnpm scan:secrets
Secret-pattern scan passed — 189 tracked files checked, no matches.

$ pnpm format
All matched files use Prettier code style!
```

## 4. `packages/database` unit tests (mocked, no database required)

```
$ pnpm --filter @webdesk/database test
 ✓ src/base-repository.test.ts (5 tests)
 ✓ src/env.test.ts (4 tests)
 ✓ src/transaction.test.ts (2 tests)
 ✓ src/health.test.ts (2 tests)
 ✓ src/connection.test.ts (6 tests)
 Test Files  5 passed (5)
      Tests  19 passed (19)
```

## 5. `packages/database` integration tests (real disposable database)

```
$ export DATABASE_URL="postgres://<local-user>@localhost:5432/webdesk_phase1b_test"
$ export DATABASE_SSL="false"
$ pnpm --filter @webdesk/database test:integration
{ event: 'migrating', name: '00001-create-framework-probe.ts' }
{ event: 'migrated', name: '00001-create-framework-probe.ts', durationSeconds: 0.043 }
{ event: 'reverting', name: '00001-create-framework-probe.ts' }
{ event: 'reverted', name: '00001-create-framework-probe.ts', durationSeconds: 0.003 }
 ✓ test/database-foundation.integration.test.ts (8 tests)
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

The 8 tests, all against the live database (none mocked): connection health reports `ok`;
repository `create`+`findById`; `findById` returns `null` for an unknown id; `update`;
`findMany` pagination math; **soft-delete** — row excluded from `findById` afterward but proven
still physically present via `model.findByPk(id, { paranoid: false })`, i.e. genuinely a soft
delete, not a hard `DELETE`; **transaction commit** — a row created inside `withTransaction`
is present afterward; **transaction rollback** — a row created inside a `withTransaction` callback
that then throws is confirmed **absent** afterward (real rollback, not asserted from documentation).

## 6. Migration round-trip, both execution paths

**Compiled CLI** (`node dist/migrate.js`, what CI's `migrate:test` script runs):

```
$ pnpm build && node dist/migrate.js up
{ event: 'migrating', name: '00001-create-framework-probe.js' }
{ event: 'migrated', name: '00001-create-framework-probe.js', durationSeconds: 0.007 }
Applied 1 migration(s): 00001-create-framework-probe.js

$ node dist/migrate.js down
{ event: 'reverting', name: '00001-create-framework-probe.js' }
{ event: 'reverted', name: '00001-create-framework-probe.js', durationSeconds: 0.006 }
Reverted 1 migration(s): 00001-create-framework-probe.js

$ psql -c '\dt'  # after down: only SequelizeMeta remains, _framework_probe is gone
```

**Vitest-direct path** (`test/database-foundation.integration.test.ts`'s own `beforeAll`/`afterAll`,
importing `src/migrate.ts` directly, transformed on the fly): verified in §5 above.

**A real bug was caught and fixed during this work, not just the final passing state**: the
migrations glob was initially `*.{js,ts}`, which also matched `.d.ts` declaration files sitting
next to the compiled `.js` output — umzug tried to "run" `00001-create-framework-probe.d.ts` as a
migration and failed with `(intermediate value).up is not a function`. Fixed by computing the
glob's extension from `import.meta.url` itself (`.ts` when running from source, `.js` when
running compiled) instead of a single ambiguous multi-extension pattern — caught by actually
executing the compiled CLI end-to-end against a real database, not by reading the code.

## 8. A second real bug, caught only by CI (not by local testing)

After pushing, CI's `database-migration-test` job failed on `pnpm build`:

```
error TS2307: Cannot find module '@webdesk/shared-types' or its corresponding type declarations.
error TS2307: Cannot find module '@webdesk/configuration' or its corresponding type declarations.
```

Every local run in this report succeeded because this session had already run `turbo run build`
across the whole monorepo many times before this work started, leaving
`packages/{shared-types,configuration}/dist/*.d.ts` on disk — `packages/database`'s own `pnpm
build` script is just `tsc -p tsconfig.json`, which resolves those two workspace dependencies'
types from their `dist/` output, not their source. On a genuinely fresh checkout (CI, or a new
clone), those `dist/` directories don't exist yet, and `packages/database`'s isolated build
fails.

**Reproduced locally** by deleting every `dist/` directory and `tsconfig.tsbuildinfo` file in the
repo first, to simulate a fresh checkout exactly:

```
$ rm -rf packages/*/dist apps/*/dist packages/*/tsconfig.tsbuildinfo apps/*/tsconfig.tsbuildinfo
$ pnpm --filter @webdesk/database migrate:test
src/base-repository.test.ts(1,33): error TS2307: Cannot find module '@webdesk/shared-types' ...
[same errors as CI]
```

**Fixed** by building through `turbo run build --filter=@webdesk/database` instead of the
package-local `pnpm build` — `turbo.json`'s `build` task already declares `dependsOn: ["^build"]`,
so turbo builds `@webdesk/shared-types` and `@webdesk/configuration` first regardless of the
`--filter` scope. `.github/workflows/ci.yml`'s `database-migration-test` job now runs this as its
own step before `migrate:test`/`test:integration`.

**Re-verified from the same fully-clean state** (all `dist/` deleted again):

```
$ npx turbo run build --filter=@webdesk/database --force
@webdesk/configuration:build: $ tsc -p tsconfig.json
@webdesk/shared-types:build: $ tsc -p tsconfig.json
@webdesk/database:build: $ tsc -p tsconfig.json
 Tasks:    3 successful, 3 total

$ pnpm --filter @webdesk/database migrate:test
Applied 1 migration(s): 00001-create-framework-probe.js
Reverted 1 migration(s): 00001-create-framework-probe.js

$ pnpm --filter @webdesk/database test:integration
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

Full monorepo suite re-run once more from the same clean state, to confirm this fix didn't affect
anything else: `turbo run typecheck lint test build --force` — 36/36 tasks; `pnpm
boundaries:check` — 0 errors; `pnpm scan:secrets` — 206 tracked files (up from 189 — this count
reflects files already staged from the Phase 1B commit), clean; `pnpm format` — clean.

**What this means for the earlier sections of this report**: every command shown in §3-§7 above
did run and did produce the output shown — nothing was fabricated — but they ran in an
environment with pre-existing build artifacts that masked this specific fresh-checkout failure
mode. This is exactly why CI, not just local testing, is part of this project's own validation
discipline.

## 7. `dashboard-api`/`dashboard-web` regression check

Re-ran both apps' own suites as part of the full `turbo run` above (not skipped): `dashboard-api`
2/2 unit + 5/5 integration tests still pass; `dashboard-web` 1/1 unit + 4/4 Playwright tests still
pass; `dashboard-api`'s `nest-cli.json` dev-crash fix from earlier in this project (Phase 1A
follow-up) still holds. No app was wired to `packages/database` as part of this task — wiring is
explicitly out of scope (task package §8).

## What this validation does NOT claim

Confirms the database _framework_ — connection, migration, transaction, repository, health —
works end-to-end against a real (if disposable) PostgreSQL instance. It does not claim any real
business entity's schema is correct (none exists yet), and it does not claim the actual chosen
Marketplace provider (Supabase) has been connected to — every test here ran against a local/CI
instance, not Supabase itself, consistent with the task package's own scope (§18: CI uses a
provider-agnostic `postgres:16` container specifically so testing doesn't require the real
provider to be provisioned).
