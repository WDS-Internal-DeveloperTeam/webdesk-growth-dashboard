---
tier: 2
load_when: ["scaffold", "code-production", "nodejs", "pt-integration-middleware", "g3"]
description: "Starter Express + Sequelize middleware service skeleton — file tree plus real, internally-consistent stubs (config, errors, logger, app/server, layering, docker-compose) agents copy at scaffold (G3)."
---

# Service Skeleton — Express + Sequelize middleware starter

> Copy this tree into a fresh repo at **scaffold (G3)**. It is a _skeleton_, not a finished app: the files below are real and correct and their imports line up, but you still wire your own controllers/services/repositories, migrations, and integration adapters on top. The layering (controllers = HTTP only, services = business logic, repositories = the only place that touches the DB) is enforced by the architecture fitness tests in `../architecture-tests/` and the forbidden rules in `knowledge/09-forbidden.md` (NODE-003, NODE-007, NODE-104, …).
>
> **Pin versions at scaffold.** The `package.json` below intentionally uses recent realistic majors. Before committing, run `npm install <pkg>@latest --save-exact` (or let your lockfile pin) so you ship a reproducible build — do not ship floating ranges into a client repo.

---

## File tree

```text
.
├── package.json
├── eslint.config.js
├── .prettierrc
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── src/
│   ├── app.js                      # Express app wiring (exported, no listen)
│   ├── server.js                   # boots app: DB connect + listen + graceful shutdown
│   ├── config/
│   │   └── index.js                # loads + validates env, exposes typed config
│   ├── lib/
│   │   ├── errors.js               # typed error classes
│   │   ├── error-handler.js        # Express centralized error middleware
│   │   └── logger.js               # structured JSON logger
│   ├── routes/
│   │   └── index.js                # mounts all routers; health route
│   ├── controllers/
│   │   └── health-controller.js    # HTTP only
│   ├── services/
│   │   └── setting-service.js      # business logic, calls repositories
│   ├── repositories/
│   │   └── setting-repository.js   # ONLY layer that touches the DB
│   ├── jobs/                       # cron / queue workers (timezone-aware)
│   │   └── .gitkeep
│   ├── integrations/               # ERP + store adapters behind the common interface
│   │   └── .gitkeep
│   └── db/
│       ├── index.js                # Sequelize init from config
│       ├── models/
│       │   └── setting.js          # example model
│       └── migrations/
│           └── .gitkeep            # see ../../templates/migration-template.js
└── tests/
    └── health.test.js              # node:test smoke test
```

`jobs/`, `integrations/`, and `db/migrations/` ship empty (`.gitkeep`) — you populate them from the sync-engine and integration knowledge files and from `../migration-template.js`.

---

## Stubs

### `package.json`

```json
{
  "name": "webdesk-middleware-service",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "start": "node src/server.js",
    "dev": "node --watch src/server.js",
    "test": "node --test",
    "lint": "eslint .",
    "format": "prettier --write .",
    "migrate": "node-pg-migrate up || sequelize-cli db:migrate"
  },
  "dependencies": {
    "express": "^5.0.0",
    "sequelize": "^6.37.0",
    "pg": "^8.13.0",
    "zod": "^3.24.0",
    "pino": "^9.5.0"
  },
  "devDependencies": {
    "eslint": "^9.15.0",
    "prettier": "^3.4.0"
  }
}
```

> The `migrate` script is a placeholder for whichever migration runner the project standardizes on (sequelize-cli or umzug). Pick one at scaffold and replace the script accordingly; the migration file format is in `../migration-template.js`.

### `src/config/index.js`

Loads and **validates** env at startup. Throws (via a typed error) if a required var is missing, so the process fails fast rather than booting half-configured. Exposes a frozen, typed config object including the **timezone** (crons are interpreted in this tz, never server-local — NODE rule on timezone-aware cron).

```js
import { z } from "zod";
import { ConfigError } from "../lib/errors.js";

/**
 * Schema for required + optional environment variables.
 * Secrets are never defaulted here — a missing secret must fail loudly (NODE-004).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  // Timezone that ALL cron schedules are interpreted in (Dashboard Settings → Timezone).
  // Never the server's local tz.
  APP_TIMEZONE: z.string().min(1),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

/**
 * @typedef {object} AppConfig
 * @property {string} env
 * @property {number} port
 * @property {string} timezone
 * @property {string} databaseUrl
 * @property {string|undefined} redisUrl
 * @property {string} logLevel
 * @property {boolean} isProduction
 */

/**
 * Parse and validate process.env into a typed, frozen config.
 * @returns {AppConfig}
 * @throws {ConfigError} when required env vars are missing or malformed.
 */
function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new ConfigError(`Invalid environment configuration: ${issues}`);
  }

  const env = parsed.data;
  return Object.freeze({
    env: env.NODE_ENV,
    port: env.PORT,
    timezone: env.APP_TIMEZONE,
    databaseUrl: env.DATABASE_URL,
    redisUrl: env.REDIS_URL,
    logLevel: env.LOG_LEVEL,
    isProduction: env.NODE_ENV === "production",
  });
}

/** Singleton, validated at module load so boot fails fast on misconfig. */
export const config = loadConfig();
```

### `src/lib/errors.js`

Typed error classes carrying an HTTP `statusCode` and preserving `cause`. Services and integrations throw these; the centralized handler maps them to responses. Never `console.log` an error (NODE-007); never swallow one (NODE-006).

```js
/**
 * Base application error. All thrown errors should extend this so the
 * centralized handler can map them deterministically.
 */
export class AppError extends Error {
  /**
   * @param {string} message
   * @param {object} [opts]
   * @param {number} [opts.statusCode=500]
   * @param {string} [opts.code]
   * @param {unknown} [opts.cause]
   */
  constructor(message, { statusCode = 500, code = "INTERNAL_ERROR", cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/** Thrown by config loading when required env is missing/invalid. */
export class ConfigError extends AppError {
  constructor(message, opts = {}) {
    super(message, { statusCode: 500, code: "CONFIG_ERROR", ...opts });
  }
}

/** Input failed validation at a boundary (NODE-005). */
export class ValidationError extends AppError {
  constructor(message, opts = {}) {
    super(message, { statusCode: 400, code: "VALIDATION_ERROR", ...opts });
  }
}

/** A requested resource does not exist. */
export class NotFoundError extends AppError {
  constructor(message, opts = {}) {
    super(message, { statusCode: 404, code: "NOT_FOUND", ...opts });
  }
}

/** A call to an external system (ERP / store) failed. */
export class IntegrationError extends AppError {
  constructor(message, opts = {}) {
    super(message, { statusCode: 502, code: "INTEGRATION_ERROR", ...opts });
  }
}

/** A sync run / reconciliation step failed. */
export class SyncError extends AppError {
  constructor(message, opts = {}) {
    super(message, { statusCode: 500, code: "SYNC_ERROR", ...opts });
  }
}
```

### `src/lib/error-handler.js`

Express centralized error middleware. Maps typed errors to status codes, logs with the structured logger, and **never leaks a stack trace in production**.

```js
import { AppError } from "./errors.js";
import { logger } from "./logger.js";
import { config } from "../config/index.js";

/**
 * 404 handler — mount AFTER all routes, BEFORE the error handler.
 * @type {import('express').RequestHandler}
 */
export function notFoundHandler(req, res, next) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
}

/**
 * Centralized error middleware. Must have arity 4 for Express to treat it as
 * an error handler. Mount LAST.
 * @type {import('express').ErrorRequestHandler}
 */
export function errorHandler(err, req, res, next) {
  const isApp = err instanceof AppError;
  const statusCode = isApp ? err.statusCode : 500;
  const code = isApp ? err.code : "INTERNAL_ERROR";

  // Structured log with context. Never console.log (NODE-007); never swallow (NODE-006).
  logger.error({ err, code, statusCode, path: req.originalUrl }, "request failed");

  const body = {
    error: {
      code,
      message: statusCode >= 500 && config.isProduction ? "Internal server error" : err.message,
    },
  };

  // Only expose stack outside production.
  if (!config.isProduction && err.stack) {
    body.error.stack = err.stack;
  }

  res.status(statusCode).json(body);
}
```

### `src/lib/logger.js`

Minimal structured JSON logger. `console.*` is not used for errors anywhere in production paths (NODE-007).

```js
import { config } from "../config/index.js";

const LEVELS = { fatal: 60, error: 50, warn: 40, info: 30, debug: 20, trace: 10 };

/**
 * Emit one structured JSON log line at the given level if it meets the threshold.
 * Errors are serialized (message + stack), never raw secrets (NODE-004).
 * @param {keyof typeof LEVELS} level
 * @param {object} context
 * @param {string} message
 */
function emit(level, context, message) {
  if (LEVELS[level] < LEVELS[config.logLevel]) return;

  const { err, ...rest } = context;
  const line = {
    level,
    time: new Date().toISOString(),
    msg: message,
    ...rest,
  };
  if (err instanceof Error) {
    line.err = { name: err.name, message: err.message, stack: err.stack };
  }
  // The ONE allowed console use: emitting structured lines to stdout/stderr,
  // which the platform's log pipeline collects. This is the sink, not error handling.
  const sink = LEVELS[level] >= LEVELS.error ? process.stderr : process.stdout;
  sink.write(`${JSON.stringify(line)}\n`);
}

/**
 * @typedef {object} Logger
 * @property {(ctx: object, msg: string) => void} error
 * @property {(ctx: object, msg: string) => void} warn
 * @property {(ctx: object, msg: string) => void} info
 * @property {(ctx: object, msg: string) => void} debug
 */

/** Structured logger. Swap for pino in production if richer features are needed. */
export const logger = {
  fatal: (ctx, msg) => emit("fatal", ctx, msg),
  error: (ctx, msg) => emit("error", ctx, msg),
  warn: (ctx, msg) => emit("warn", ctx, msg),
  info: (ctx, msg) => emit("info", ctx, msg),
  debug: (ctx, msg) => emit("debug", ctx, msg),
  trace: (ctx, msg) => emit("trace", ctx, msg),
};
```

### `src/app.js`

Builds and **exports** the Express app (no `listen` here — that's `server.js`, which keeps the app testable).

```js
import express from "express";
import { router } from "./routes/index.js";
import { notFoundHandler, errorHandler } from "./lib/error-handler.js";

/**
 * Build the Express application. Exported without listening so tests can mount it.
 * @returns {import('express').Express}
 */
export function createApp() {
  const app = express();

  // JSON body parsing for normal routes. NOTE: webhook routes that verify HMAC
  // need the RAW body instead — mount express.raw on those paths BEFORE this.
  app.use(express.json({ limit: "1mb" }));

  app.use("/", router);

  // 404 then centralized error handler — order matters.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
```

### `src/server.js`

Boots the app: connects the DB, starts listening, and shuts down gracefully on `SIGTERM`/`SIGINT`.

```js
import { app } from "./app.js";
import { config } from "./config/index.js";
import { logger } from "./lib/logger.js";
import { sequelize } from "./db/index.js";

/** Start the HTTP server after verifying the DB connection. */
async function start() {
  await sequelize.authenticate();
  logger.info({}, "database connection established");

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, env: config.env, tz: config.timezone }, "server listening");
  });

  /**
   * Drain connections, close the server and the DB pool, then exit.
   * @param {string} signal
   */
  async function shutdown(signal) {
    logger.info({ signal }, "shutdown initiated");
    server.close(async () => {
      try {
        await sequelize.close();
        logger.info({}, "shutdown complete");
        process.exit(0);
      } catch (err) {
        logger.error({ err }, "error during shutdown");
        process.exit(1);
      }
    });
    // Failsafe: force-exit if connections don't drain in time.
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

start().catch((err) => {
  logger.error({ err }, "failed to start server");
  process.exit(1);
});
```

### `src/routes/index.js`

Mounts all routers. Includes the sample health route.

```js
import { Router } from "express";
import { getHealth } from "../controllers/health-controller.js";

export const router = Router();

// Liveness/readiness probe used by docker-compose + the monitoring stack.
router.get("/health", getHealth);

// Mount feature routers here, e.g.:
// router.use('/settings', settingRouter);
```

### `src/controllers/health-controller.js`

HTTP only — no business logic, no DB access.

```js
/**
 * GET /health — liveness probe. HTTP-only; returns 200 with minimal status.
 * @type {import('express').RequestHandler}
 */
export function getHealth(req, res) {
  res.status(200).json({ status: "ok", time: new Date().toISOString() });
}
```

### `src/services/setting-service.js`

Business logic. Calls the repository — it never touches the DB directly (NODE-003).

```js
import { NotFoundError } from "../lib/errors.js";
import * as settingRepository from "../repositories/setting-repository.js";

/**
 * Read a tenant setting by key.
 * @param {string} tenantId
 * @param {string} key
 * @returns {Promise<{ key: string, value: string }>}
 * @throws {NotFoundError} when the setting does not exist for the tenant.
 */
export async function getSetting(tenantId, key) {
  const setting = await settingRepository.findByKey(tenantId, key);
  if (!setting) {
    throw new NotFoundError(`Setting '${key}' not found`);
  }
  return { key: setting.key, value: setting.value };
}

/**
 * Create or update a tenant setting (idempotent upsert).
 * @param {string} tenantId
 * @param {string} key
 * @param {string} value
 * @returns {Promise<{ key: string, value: string }>}
 */
export async function upsertSetting(tenantId, key, value) {
  const saved = await settingRepository.upsert(tenantId, key, value);
  return { key: saved.key, value: saved.value };
}
```

### `src/repositories/setting-repository.js`

The **only** layer that touches the DB. Every query is scoped by `tenantId` (NODE-104).

```js
import { Setting } from "../db/models/setting.js";

/**
 * Find a setting by key for a tenant.
 * @param {string} tenantId
 * @param {string} key
 * @returns {Promise<Setting|null>}
 */
export async function findByKey(tenantId, key) {
  // tenant_id is ALWAYS in the where clause (NODE-104).
  return Setting.findOne({ where: { tenantId, key } });
}

/**
 * Idempotent upsert of a setting, keyed by (tenantId, key).
 * @param {string} tenantId
 * @param {string} key
 * @param {string} value
 * @returns {Promise<Setting>}
 */
export async function upsert(tenantId, key, value) {
  const [setting] = await Setting.upsert({ tenantId, key, value }, { returning: true });
  return setting;
}
```

### `src/db/index.js`

Sequelize init reading from config.

```js
import { Sequelize } from "sequelize";
import { config } from "../config/index.js";
import { logger } from "../lib/logger.js";

/** Shared Sequelize instance. Models register themselves against this. */
export const sequelize = new Sequelize(config.databaseUrl, {
  dialect: "postgres",
  logging: config.isProduction ? false : (sql) => logger.debug({ sql }, "sequelize query"),
  pool: { max: 10, min: 0, idle: 10_000 },
});
```

### `src/db/models/setting.js`

```js
import { DataTypes, Model } from "sequelize";
import { sequelize } from "../index.js";

/** Per-tenant key/value setting (timezone, sync cadences, feature flags, …). */
export class Setting extends Model {}

Setting.init(
  {
    tenantId: { type: DataTypes.UUID, allowNull: false, field: "tenant_id" },
    key: { type: DataTypes.STRING, allowNull: false },
    value: { type: DataTypes.TEXT, allowNull: false },
  },
  {
    sequelize,
    modelName: "Setting",
    tableName: "settings",
    underscored: true,
    indexes: [{ unique: true, fields: ["tenant_id", "key"] }],
  },
);
```

### `tests/health.test.js`

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { getHealth } from "../src/controllers/health-controller.js";

test("GET /health returns 200 ok", () => {
  let statusCode = 0;
  let body = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };

  getHealth({}, res);

  assert.equal(statusCode, 200);
  assert.equal(body.status, "ok");
});
```

### `docker-compose.yml`

`app`, `postgres`, `redis`, plus local **mock-erp** and **mock-store** stub HTTP servers so integration code can run against the adapter interface without a real ERP/store (NODE-008: build against a mock, never a guessed real endpoint).

```yaml
services:
  app:
    build: .
    environment:
      NODE_ENV: development
      PORT: "3000"
      APP_TIMEZONE: America/Toronto
      DATABASE_URL: postgres://app:app@postgres:5432/middleware
      REDIS_URL: redis://redis:6379
      LOG_LEVEL: debug
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
        ]
      interval: 15s
      timeout: 5s
      retries: 5

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: middleware
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d middleware"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Local stub of the ERP web service. Stand up a small node:http server under
  # ./mock/erp that returns canned, contract-shaped responses. It exists ONLY so
  # the adapter + sync engine can run end-to-end locally — it is not the real ERP.
  mock-erp:
    image: node:22-alpine
    working_dir: /app
    command: ["node", "erp.js"]
    volumes:
      - ./mock/erp:/app
    ports:
      - "4010:4010"

  # Local stub of the commerce store (BigCommerce/Shopify) for webhook + push tests.
  mock-store:
    image: node:22-alpine
    working_dir: /app
    command: ["node", "store.js"]
    volumes:
      - ./mock/store:/app
    ports:
      - "4020:4020"

volumes:
  pgdata:
  redisdata:
```

> Create `./mock/erp/erp.js` and `./mock/store/store.js` as tiny `node:http` servers returning contract-shaped fixtures. They are local stub servers, not images we publish.

### `Dockerfile`

```dockerfile
FROM node:22-alpine

WORKDIR /app

# Install deps first for layer caching.
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 3000

# Run as the built-in non-root user.
USER node

CMD ["node", "src/server.js"]
```

### `.env.example`

Every required var, commented. Copy to `.env` and fill in real values; never commit `.env` (NODE-004).

```dotenv
# Runtime mode: development | test | production
NODE_ENV=development

# HTTP port the service listens on
PORT=3000

# REQUIRED. Timezone ALL cron schedules are interpreted in (Dashboard Settings → Timezone).
# Crons are NEVER interpreted in the server's local timezone.
APP_TIMEZONE=America/Toronto

# REQUIRED. Postgres connection string.
DATABASE_URL=postgres://app:app@localhost:5432/middleware

# Optional. Redis connection string — required only when BullMQ queues are enabled.
REDIS_URL=redis://localhost:6379

# Log level: fatal | error | warn | info | debug | trace
LOG_LEVEL=info

# --- Integration secrets (add per project; verified at G-Contracts) -----------
# Never commit real values. Each maps to auth.credential_location in the contract.
# ERP_DDI_API_TOKEN=
# STORE_WEBHOOK_SECRET=
```

### `eslint.config.js` (flat config)

Enforces the standards: no `var`, prefer `const`, no `console` for errors, ES Modules.

```js
import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: {
        process: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
      },
    },
    rules: {
      // Hard standards (mirror knowledge/09-forbidden.md).
      "no-var": "error", // NODE-001
      "prefer-const": "error",
      "no-console": ["error", { allow: [] }], // NODE-007: logger only; sink lives in logger.js
      "no-empty": ["error", { allowEmptyCatch: false }], // NODE-006
      eqeqeq: ["error", "always"],
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_|^next$" }],
    },
  },
  {
    // The logger is the one place allowed to write to process.stdout/stderr.
    files: ["src/lib/logger.js"],
    rules: { "no-console": "off" },
  },
  {
    files: ["tests/**/*.js"],
    languageOptions: { globals: { describe: "readonly", it: "readonly" } },
  },
];
```

### `.prettierrc`

```json
{
  "singleQuote": true,
  "semi": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

### `.gitignore`

```gitignore
node_modules/
.env
.env.*
!.env.example
coverage/
dist/
*.log
```

---

## After copying

1. `npm install` then pin versions (`--save-exact` or commit the lockfile).
2. Fill `.env` from `.env.example`.
3. `docker compose up postgres redis` and run `npm run migrate` (write your first migration from `../migration-template.js`).
4. `npm test` (node:test) and `npm run lint` should pass on the skeleton as-is.
5. Add the architecture fitness tests from `../architecture-tests/` and wire them into CI (gated at G5).

Last reviewed: 2026-06-30 by Claude (initial build)
