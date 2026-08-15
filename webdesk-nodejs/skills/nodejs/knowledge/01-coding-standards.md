---
tier: 1
load_when: ["code-production"]
description: "The Node.js coding standards (blueprint §11) with rationale and examples, plus the canonical project layout. Enforced by ESLint/Prettier + Code Review."
---

# 01 — Node.js Coding Standards

> The full standards list from blueprint §11, each with a one-line rationale and a short example where it helps. Enforced by ESLint + Prettier and by Code Review on every PR. The _forbidden_ counterparts (hard rejects) live in `09-forbidden.md` — read that first.

---

## Language & runtime

### Node.js 22+, ES Modules (`import` / `export`)

**Why:** ESM is the platform standard, gives static analysis, top-level await, and a single module system across the codebase. `"type": "module"` in `package.json`.

```js
// good
import { syncOrders } from "./services/order-sync-service.js";
export async function runSync() {
  /* ... */
}

// bad — CommonJS in new code
const { syncOrders } = require("./services/order-sync-service");
module.exports = { runSync };
```

Note ESM specifics: include the `.js` extension in relative imports; no `__dirname`/`__filename` (derive via `import.meta.url`).

### `async/await` only — no `.then()` chains in new code

**Why:** Linear control flow, one error path (`try/catch`), no nesting or lost rejections.

```js
// good
const order = await orderRepository.findById(id);
const result = await store.pushOrder(order);

// bad
orderRepository.findById(id).then((order) => store.pushOrder(order)).then(...);
```

### `const` by default; `let` only when reassigning; never `var`

**Why:** Block scoping + immutability of bindings prevents an entire class of hoisting and reassignment bugs. `var` is banned (NODE-001).

```js
const items = await repo.list(); // never reassigned → const
let cursor = null; // reassigned in the loop → let
```

---

## Naming (summary — full rules in `02-naming-conventions.md`)

### `camelCase` variables/functions, `PascalCase` classes, **kebab-case filenames**

**Why:** One predictable convention per artifact kind; kebab-case filenames are case-safe across Linux/macOS and match the layered folder names.

```
src/services/order-sync-service.js   →  export class OrderSyncService { syncOrders() {} }
src/controllers/auth-controller.js   →  export async function login(req, res) {}
```

---

## Functions & control flow

### Small, single-purpose functions; early returns, no deep nesting

**Why:** Each function does one thing and is testable in isolation; early returns flatten the happy path and make guard clauses obvious.

```js
// good — guard clauses, then the happy path
async function activateUser(id) {
  const user = await userRepository.findById(id);
  if (!user) throw new NotFoundError("user");
  if (user.status === "active") return user;
  return userRepository.update(id, { status: "active" });
}
```

---

## Layering (the core architectural rule)

### Controllers = HTTP only; business logic in services; DB access in repositories

**Why:** Single responsibility per layer makes the system testable, swappable, and tenant-safe. Enforced by architecture fitness tests at G5 and by Code Review (NODE-003 forbids DB access outside repositories).

```js
// controllers/order-controller.js — HTTP only
export async function getOrder(req, res, next) {
  try {
    const order = await orderService.getForTenant(req.tenantId, req.params.id);
    res.json(order);
  } catch (err) {
    next(err);
  } // delegate to centralized error handler
}

// services/order-service.js — business logic, no req/res, no SQL
export async function getForTenant(tenantId, id) {
  const order = await orderRepository.findById(tenantId, id);
  if (!order) throw new NotFoundError("order");
  return order;
}

// repositories/order-repository.js — the ONLY place touching the DB; tenant-scoped
export async function findById(tenantId, id) {
  return Order.findOne({ where: { id, tenantId } });
}
```

---

## Input, errors, config

### Validate all external input

**Why:** Anything from the network — request bodies, query params, webhook payloads, **and ERP/store API responses** — is untrusted (NODE-005). Validate at the boundary with a schema (e.g. `zod`/`joi`) before it reaches a service.

```js
const CreateUser = z.object({ email: z.string().email(), roleId: z.string().uuid() });
const data = CreateUser.parse(req.body); // throws on bad input → handled centrally
```

### Centralized error handling; throw errors, don't `console.log`

**Why:** One place to log, classify, and map errors to status codes; throwing typed errors keeps services HTTP-agnostic. Swallowing errors or logging-and-continuing hides failures (NODE-006/007).

```js
// lib/errors.js — typed errors
export class NotFoundError extends Error {
  constructor(r) {
    super(`${r} not found`);
    this.status = 404;
  }
}

// app: last middleware
app.use((err, req, res, _next) => {
  logger.error({ err, reqId: req.id }, "request failed");
  res.status(err.status ?? 500).json({ error: err.publicMessage ?? "internal_error" });
});
```

### Env vars for secrets and config

**Why:** Secrets and per-environment config never live in code or git (NODE-004). Load and validate them once at boot (see `security/03-secrets-and-config.md`).

```js
const config = { dbUrl: requireEnv("DATABASE_URL"), jwtSecret: requireEnv("JWT_SECRET") };
```

---

## Modularity, docs, dependencies, style

### Modular, reusable; no duplication

**Why:** Shared logic lives once in `lib/` or a service. Duplicated logic drifts and is the source of the copy-paste bugs the SOW process flags.

### JSDoc only on exported/public functions

**Why:** Document the contract at module boundaries; don't clutter internal helpers whose names already explain them.

```js
/**
 * Sync orders from the ERP into the store for one tenant.
 * @param {string} tenantId
 * @param {Date} since - watermark; only orders changed after this are pulled.
 * @returns {Promise<{synced: number, skipped: number}>}
 */
export async function syncOrders(tenantId, since) {
  /* ... */
}
```

### Prefer native Node APIs; minimize dependencies

**Why:** Fewer dependencies = smaller attack surface, fewer CVEs, lighter lockfile. Use `node:`-prefixed builtins (`node:crypto`, `node:fs/promises`, `fetch`, `node:test`) before reaching for a package.

### ESLint + Prettier defaults; concise comments only when non-obvious

**Why:** Tooling settles formatting and catches mistakes so reviews discuss substance. Comments explain _why_ a non-obvious choice was made, not _what_ the code does.

### Production-ready, maintainable code

**Why:** This is delivered client software under retainer. No TODOs left as the implementation, no dead code, no debug logging in the request path. If it ships, it's complete.

---

## Canonical project layout

Every Node service uses this structure (the `src/` layers map 1:1 to the layering in `00-overview.md`):

```
project-root/
├── package.json            "type": "module", engines.node ">=22", scripts
├── package-lock.json       committed; lockfile discipline (backend/02)
├── .env.example            every required var, no real values
├── eslint.config.js
├── .prettierrc
├── src/
│   ├── controllers/        HTTP only (auth-controller.js, order-controller.js)
│   ├── services/           business logic (order-sync-service.js)
│   ├── repositories/       DB access only, tenant-scoped (order-repository.js)
│   ├── routes/             Express routers wiring paths → controllers
│   ├── jobs/               cron/queue entry points (order-sync-job.js)
│   ├── integrations/       external adapters (erp/, bigcommerce/, shopify/)
│   ├── lib/                pure helpers, errors, logger, validation
│   ├── config/             env loading + validation, app bootstrap
│   ├── db/
│   │   ├── migrations/     Sequelize migrations (forward + down)
│   │   └── models/         Sequelize model definitions
│   └── app.js / server.js  Express app assembly + graceful shutdown
└── test/                   node:test or vitest; supertest; fixtures
```

Read on demand: `backend/01-runtime-and-frameworks.md` (Express/middleware/shutdown), `database/02-migrations-and-rollback.md`, `integration/02-queues-and-jobs.md`.
