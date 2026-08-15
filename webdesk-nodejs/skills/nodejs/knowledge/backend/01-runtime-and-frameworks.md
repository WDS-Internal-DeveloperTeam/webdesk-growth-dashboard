---
tier: 2
load_when: ["code-production", "backend-active"]
description: "Express app structure, middleware order, config/bootstrap, graceful shutdown, and health endpoints."
---

# Backend 01 — Runtime & Frameworks

> How a Node + Express service is assembled: app structure, the middleware order that matters, config/bootstrap, graceful shutdown, and health endpoints. Applies to every Node service (custom app, middleware, frontend-tool BFF).

---

## App assembly

Split the **app** (Express instance, wiring) from the **server** (listen, lifecycle) so the app is importable in tests without binding a port.

```
src/
├── config/index.js     load + validate env once, export typed config
├── app.js              build the Express app (middleware + routes), export it
└── server.js           import app, start listening, wire graceful shutdown
```

```js
// app.js
import express from "express";
import { router } from "./routes/index.js";
import { errorHandler } from "./lib/error-handler.js";

export function buildApp() {
  const app = express();
  app.disable("x-powered-by");
  // ...middleware (see order below)...
  app.use("/api/v1", router);
  app.use(errorHandler); // last
  return app;
}
```

---

## Middleware order (it matters)

Order is not cosmetic — auth must run before handlers, the error handler must be last, body parsing must precede validation, and **raw-body capture for webhook HMAC must run before JSON parsing** (you can't verify a signature over a re-serialized body).

```
1. requestId / correlation-id        (so every log line ties to a request)
2. structured logger (pino-http)
3. security headers (helmet), CORS
4. rate limiter (per-route where needed)
5. webhook raw-body capture          ← only on webhook routes, BEFORE json()
6. body parsing (express.json with size limit)
7. authentication (JWT verify) → attaches req.user, req.tenantId
8. authorization (per-module RBAC)   → checks req.user against the route's module/action
9. route handlers (controllers)
10. 404 handler
11. centralized error handler        ← LAST, 4-arg signature
```

```js
app.use(express.json({ limit: "1mb" })); // bound the body — unbounded = DoS
```

Tenant context (`req.tenantId`) is set in the auth middleware and flows into every service/repository call — never inferred later.

---

## Config & bootstrap

Load and **validate** env once at startup; fail fast if a required var is missing (don't discover it on the first request).

```js
// config/index.js
function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}
export const config = Object.freeze({
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: requireEnv("DATABASE_URL"),
  jwt: {
    accessSecret: requireEnv("JWT_ACCESS_SECRET"),
    refreshSecret: requireEnv("JWT_REFRESH_SECRET"),
  },
  timezone: process.env.APP_TIMEZONE ?? "UTC", // display/scheduling tz; storage is UTC
});
```

---

## Graceful shutdown

On `SIGTERM`/`SIGINT`: stop accepting new connections, let in-flight requests finish, drain queue workers and cron, close the DB pool, then exit. Required for zero-downtime deploys and for not corrupting a sync mid-run.

```js
// server.js
const server = buildApp().listen(config.port);

async function shutdown(signal) {
  logger.info({ signal }, "shutting down");
  server.close(); // stop new connections
  await stopScheduler(); // stop cron from firing new runs
  await drainQueueWorkers(); // let in-flight jobs finish or checkpoint
  await sequelize.close(); // close DB pool
  process.exit(0);
}
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => shutdown(sig));

process.on("unhandledRejection", (err) => {
  logger.fatal({ err }, "unhandledRejection");
  process.exit(1);
});
```

A sync job killed mid-run must resume cleanly from its watermark on next start (`integration/01-sync-strategies.md`); shutdown should checkpoint, not abandon.

---

## Health endpoints

Two distinct checks — don't conflate them:

- **Liveness** `GET /healthz` — process is up. Cheap, no dependencies. Used by the orchestrator/host to restart a hung process.
- **Readiness** `GET /readyz` — dependencies reachable (DB ping, Redis ping, and a cheap reachability check for critical upstreams). Used by load balancers to decide whether to route traffic. Returns 503 when a dependency is down so the deploy adapter's health-check step (`§15`) catches a bad release.

```js
app.get("/healthz", (_req, res) => res.json({ status: "ok" }));
app.get("/readyz", async (_req, res) => {
  try {
    await db.ping();
    res.json({ status: "ready" });
  } catch (err) {
    res.status(503).json({ status: "unready" });
  }
});
```

These feed the G5.5 observability gate and the deploy → migrate → release → **health-check** → rollback abstraction (`§15`).
