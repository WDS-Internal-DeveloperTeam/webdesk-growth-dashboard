# @webdesk/database

The **sole** Sequelize model/connection/migration implementation boundary (ADR-0006, WDS-011).
No other app or package in this monorepo instantiates its own Sequelize connection or defines
its own models — enforced structurally by `dependency-cruiser.config.cjs`'s
`only-database-package-touches-sequelize` rule.

**Phase 1B status:** real connection, migration framework, transaction helper, and a generic
Sequelize-backed repository base — all proven against a minimal test-only table
(`_framework_probe`), not any real business entity. `projects`/`users` (or any other entity)
require a separate, explicit authorization beyond this package's own scope — see
`docs/task-packages/phase-1b-database-foundation.md` §9/§24.

## Local development setup

You need a real, disposable PostgreSQL instance — never staging/production, never a shared
database. Two ways to get one:

**Option A — a local Postgres install (what this package was actually developed and verified
against in this environment, which has no Docker available):**

```bash
brew install postgresql@17   # or any reasonably recent Postgres
brew services start postgresql@17
createdb webdesk_phase1b_dev
```

**Option B — Docker**, if available:

```bash
docker run --name webdesk-phase1b-dev -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16
```

Either way, set the environment variables this package reads (`src/env.ts`):

```bash
export DATABASE_URL="postgres://<user>[:<password>]@localhost:5432/webdesk_phase1b_dev"
export DATABASE_SSL="false"   # local Postgres has no TLS configured — see the note below
```

**Why `DATABASE_SSL=false` locally:** `src/connection.ts` requires SSL by default in every
environment (`docs/task-packages/phase-1b-database-foundation.md` §12) — this is the one
carved-out, explicitly-documented exception the task package anticipated: a disposable local/CI
test database has no TLS-enabled Postgres image, and setting one up for throwaway test data isn't
worth the complexity. **Never set `DATABASE_SSL=false` for a real staging/production connection
string.**

## Running migrations

```bash
pnpm build                # migrations run against compiled output, same as every other app's entrypoint
pnpm migrate               # applies all pending migrations
pnpm migrate:down          # reverts the single most-recently-applied migration
pnpm migrate:test          # up, then down — round-trip test (what CI runs)
```

Migrations live in `src/migrations/*.ts`, each exporting `up`/`down` functions
(`{ context: QueryInterface }` → `Promise<void>`). The runner (`src/migrate.ts`) is
[umzug](https://github.com/sequelize/umzug), chosen over `sequelize-cli` because it's
programmatic/testable rather than CLI-and-config-file-first — see
`docs/task-packages/phase-1b-database-foundation.md` §11 for the full reasoning.

**Never** use Sequelize's `sync()` (with or without `alter: true`) against any environment —
migrations are the only schema-change path.

## Tests

```bash
pnpm test               # unit tests only — mocked models/connections, no database needed
pnpm test:integration   # real disposable database required (DATABASE_URL as above)
```

Unit tests (`src/**/*.test.ts`) cover this package's own logic (env validation, pool config,
Date→ISO translation, pagination math) against mocks. The integration suite
(`test/database-foundation.integration.test.ts`) runs the whole stack — migration up, repository
CRUD, soft-delete, real transaction commit/rollback, health check, migration down — against a
real Postgres instance. Both were verified passing in this environment before this package was
proposed as complete.

## What this package does not do yet

- No real business entity (`projects`, `users`, or anything else) — proposed, not created, per
  the task package's two-tier authorization gate.
- No connection pooler beyond Sequelize's own pool config — the exact serverless-pooling
  mechanism (whether Supabase's own pooler is used, etc.) is finalized once that's decided at
  Phase 1B execution time, not fixed here.
- No RBAC, authentication, or audit-log persistence — later phases.
