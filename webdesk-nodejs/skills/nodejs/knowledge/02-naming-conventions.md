---
tier: 2
load_when: ["code-production"]
description: "Naming conventions for files, variables, classes, DB tables/columns, env vars, and git branches across the Node.js arm."
---

# 02 — Naming Conventions

> One predictable convention per artifact kind. Code Review checks these; ESLint enforces the JS-identifier ones. Consistency is the point — a reviewer should know what a name _is_ from its shape.

---

## Files & folders

**kebab-case**, suffixed by role so the layer is obvious from the filename.

| Kind                | Pattern                                      | Example                                          |
| ------------------- | -------------------------------------------- | ------------------------------------------------ |
| Controller          | `*-controller.js`                            | `auth-controller.js`, `order-controller.js`      |
| Service             | `*-service.js`                               | `order-sync-service.js`                          |
| Repository          | `*-repository.js`                            | `user-repository.js`                             |
| Route module        | `*-routes.js`                                | `order-routes.js`                                |
| Job (cron/queue)    | `*-job.js`                                   | `order-sync-job.js`                              |
| Integration adapter | `<system>-adapter.js` / `<system>-client.js` | `ddi-inform-adapter.js`, `bigcommerce-client.js` |
| Sequelize model     | singular kebab                               | `db/models/order.js`, `db/models/sync-state.js`  |
| Migration           | timestamp-prefixed                           | `db/migrations/20260630120000-create-orders.js`  |
| Test                | mirror source + `.test.js`                   | `order-service.test.js`                          |
| Lib helper          | descriptive kebab                            | `retry-with-backoff.js`, `errors.js`             |

Folders are kebab-case and plural for collections (`controllers/`, `repositories/`, `integrations/erp/`).

---

## JavaScript identifiers

| Kind                                 | Convention                                     | Example                                  |
| ------------------------------------ | ---------------------------------------------- | ---------------------------------------- |
| Variables, function params           | `camelCase`                                    | `tenantId`, `lastSyncedAt`               |
| Functions / methods                  | `camelCase`, verb-first                        | `syncOrders()`, `findById()`             |
| Classes                              | `PascalCase`                                   | `OrderSyncService`, `NotFoundError`      |
| Constants (true module-level consts) | `UPPER_SNAKE_CASE`                             | `MAX_RETRIES`, `DEFAULT_PAGE_SIZE`       |
| Booleans                             | `is`/`has`/`should` prefix                     | `isActive`, `hasConflict`, `shouldRetry` |
| Async functions returning promises   | name as the action                             | `fetchOrders()`, not `getOrdersAsync()`  |
| Private/internal (convention)        | leading `_` only inside a class for non-public | `_buildQuery()`                          |

Avoid abbreviations except well-known ones (`id`, `url`, `db`, `tz`). Acronyms in PascalCase keep one capital: `HttpClient`, `JwtService` — not `HTTPClient`.

---

## Database — tables & columns (Postgres + Sequelize default)

| Element      | Convention                               | Example                                                    |
| ------------ | ---------------------------------------- | ---------------------------------------------------------- |
| Table names  | **snake_case, plural**                   | `users`, `roles`, `role_module_permissions`, `sync_states` |
| Columns      | **snake_case**                           | `first_name`, `created_at`, `last_synced_at`, `tenant_id`  |
| Primary key  | `id` (UUID default)                      | `id`                                                       |
| Foreign keys | `<singular>_id`                          | `user_id`, `role_id`, `tenant_id`                          |
| Join tables  | both singulars, alpha order              | `role_module`                                              |
| Timestamps   | `created_at`, `updated_at`, `deleted_at` | (Sequelize `underscored: true`)                            |
| Indexes      | `idx_<table>_<cols>`                     | `idx_orders_tenant_id_status`                              |
| Booleans     | `is_`/`has_` prefix                      | `is_active`                                                |

Set Sequelize models with `underscored: true` so JS `camelCase` attributes map to DB `snake_case` columns automatically. **Every tenant-owned table has `tenant_id`** (see `database/03-multi-tenancy.md`).

---

## Environment variables

**UPPER_SNAKE_CASE**, grouped by concern with a prefix. Documented in `.env.example` (no values).

```
DATABASE_URL
JWT_ACCESS_SECRET
JWT_REFRESH_SECRET
JWT_ACCESS_TTL=15m
ERP_DDI_BASE_URL
ERP_DDI_API_KEY
BIGCOMMERCE_STORE_HASH
BIGCOMMERCE_ACCESS_TOKEN
REDIS_URL
S3_BUCKET
APP_TIMEZONE          # display/scheduling tz; storage is always UTC
```

Prefix external-system vars by system (`ERP_DDI_*`, `BIGCOMMERCE_*`) so scope is obvious and rotation is targeted.

---

## API routes

kebab-case, plural nouns, versioned. No verbs in paths (HTTP method is the verb).

```
GET    /api/v1/orders
GET    /api/v1/orders/:id
POST   /api/v1/sync-runs
GET    /api/v1/sync-states/:entity
```

---

## Git branches & commits

| Kind    | Pattern                | Example                            |
| ------- | ---------------------- | ---------------------------------- |
| Feature | `feat/<ticket>-<slug>` | `feat/WD-123-order-sync`           |
| Fix     | `fix/<ticket>-<slug>`  | `fix/WD-130-webhook-replay`        |
| Chore   | `chore/<slug>`         | `chore/bump-node-22`               |
| Commits | Conventional Commits   | `feat(sync): add watermark resume` |

Ticket IDs tie back to the G1 estimate→ticket record.
