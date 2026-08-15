---
tier: 2
load_when: ["scaffold", "dev-environment"]
description: "Local-first dev environment: Node 22 + Docker Compose (app + Postgres + queue + mock ERP/store)."
---

# Dev Environment Setup (Node.js, local-first)

> Every project runs **locally first** (blueprint §15) before any cloud deploy. Local is also the cheapest place to run load/chaos tests. The standard local stack is Docker Compose: **app + Postgres + queue (Redis) + a mock ERP and mock store**. Verified at G3.

---

## Prerequisites

- **Node.js 22+** (ES Modules). Pin with `.nvmrc` (`22`) and `package.json` `"engines": { "node": ">=22" }`.
- **Docker + Docker Compose v2** (`docker compose`, not the legacy `docker-compose`).
- `git`, `jq` (audit-log writes), and the project's CLI tools.
- Corepack-enabled package manager (npm or pnpm) — pin the version in `packageManager`.

`tools/scripts/check-env.sh` validates Node 22+, Docker, Compose, and `jq` at session start (`01-session-start-protocol.md` Step 1).

---

## First-run

```bash
nvm use                      # Node 22 from .nvmrc
cp .env.example .env         # fill in local values — NEVER commit .env
npm ci                       # exact install from package-lock
docker compose up -d         # app + postgres + redis + mocks
npm run migrate              # run migrations against the local Postgres
npm run seed                 # optional local seed data
npm run dev                  # app with watch reload
```

`.env` is gitignored; `.env.example` ships every key with **no values** (FG-001).

---

## Docker Compose services

The standard `docker-compose.yml` brings up:

| Service        | Purpose                                       | Notes                                                                                |
| -------------- | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| **app**        | the Node/Express service (+ dashboard)        | watch reload; reads all config from env                                              |
| **postgres**   | PostgreSQL (Sequelize target)                 | named volume for persistence; healthcheck `pg_isready`                               |
| **redis**      | queue/cache backend                           | for BullMQ when concurrency/retries/DLQ are needed; `node-cron` for simple schedules |
| **mock-erp**   | a stub of the ERP API (e.g. DDI Inform)       | serves canned/recorded responses; lets sync run with no real credentials             |
| **mock-store** | a stub of the store API (BigCommerce/Shopify) | webhook emitter + REST stubs for integration tests                                   |

The mocks matter: the real ERP surface is often credential-gated and **UNVERIFIED** at the start. Build the adapter against the documented contract + the mock (`_erp-adapter-pattern.md`), mark unknowns `verify-at-discovery`, and swap to the sandbox when credentials arrive. Compose coming up healthy (all services + migrations) is a G3 check.

Sketch (services only — fill ports/versions per project, do not invent image tags you haven't pinned):

```yaml
services:
  app: { build: ., env_file: .env, depends_on: [postgres, redis], command: npm run dev }
  postgres:
    {
      image: postgres:16,
      healthcheck: { test: ["CMD", "pg_isready"] },
      volumes: [pgdata:/var/lib/postgresql/data],
    }
  redis: { image: redis:7 }
  mock-erp: { build: ./test/mocks/erp }
  mock-store: { build: ./test/mocks/store }
volumes: { pgdata: {} }
```

---

## Standard npm scripts

```
dev         nodemon/tsx watch — local run
start       node src/server.js — production entry
migrate     run pending migrations (sequelize-cli / umzug)
migrate:undo   roll back the last migration (reversibility is required, FG-007)
seed        local seed data
lint        eslint .
format      prettier --write .
typecheck   tsc --noEmit            (if TypeScript)
test        unit + integration
test:load   load/soak profile (run locally first — feeds SLO/SLA)
audit       OSV-Scanner / npm audit — dependency CVEs
```

---

## Timezone in local dev

The operational clock is `project.json.timezone` mirrored in Dashboard Settings — **not** the container's local tz. Set the app's scheduler to read the configured IANA timezone; cron windows ("nightly 2am") mean the _client's_ 2am. Store timestamps in UTC, display in the configured tz. Run containers in UTC and let the app resolve the business timezone, so "last synced at" and reconciliation boundaries line up with the client's business day.

---

## Local → promote

Same gates/runbooks apply on every host. The deploy adapter abstracts `build → migrate → release → health-check → rollback` with a per-target implementation (AWS / GCP / Cloudflare edge / Heroku / VPS), so local Compose, staging, and production differ only in the adapter and the observability tooling, not the workflow. No migration runs in a shared env before **G-Schema** passes; no promotion without a tested backup/rollback (**G6**, FG-007).

---

## Anti-patterns

1. Running against the real ERP/store before mocks + contract are in place. 2. Committing `.env`. 3. Reading the container's local tz instead of `project.json.timezone`. 4. A migration with no `down` (FG-007). 5. Skipping `docker compose` and pointing the app at a shared DB "just to test". 6. Load-testing first in the cloud — do it locally first (cheaper).

---

Last reviewed: 2026-06-30 (initial Node.js build)
Next review due: 2026-09-30
