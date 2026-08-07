import { Sequelize } from "sequelize";
import { loadDatabaseEnv, type DatabaseEnv } from "./env.js";

/**
 * Cached at module scope so a warm Vercel Function invocation reuses the
 * same Sequelize instance instead of reconstructing it per request — a cold
 * start still gets a fresh instance, which is expected and fine. See
 * docs/task-packages/phase-1b-database-foundation.md §13.
 */
let cachedConnection: Sequelize | null = null;

/**
 * Constructs (or returns the cached) Sequelize connection. Construction is
 * lazy — Sequelize does not open a socket until the first query or an
 * explicit `.authenticate()` call, so calling this alone does not prove
 * connectivity. Use `checkDatabaseHealth` (./health.js) for a liveness
 * check.
 *
 * Pool sizing is small and serverless-aware by default (§13) — never a
 * persistent-process-style pool (`max: 10`+). SSL is required by default in
 * every environment (§12); the one carved-out exception is a local/CI
 * disposable test database, which sets DATABASE_SSL=false explicitly (no
 * TLS-enabled Postgres image is used for throwaway test data) — never for a
 * real staging/production connection string.
 */
export function getConnection(env: DatabaseEnv = loadDatabaseEnv()): Sequelize {
  if (cachedConnection) {
    return cachedConnection;
  }

  cachedConnection = new Sequelize(env.DATABASE_URL, {
    dialect: "postgres",
    logging: false,
    dialectOptions: env.DATABASE_SSL ? { ssl: { require: true, rejectUnauthorized: true } } : {},
    pool: {
      max: env.DATABASE_POOL_MAX,
      min: env.DATABASE_POOL_MIN,
      idle: env.DATABASE_POOL_IDLE_MS,
      acquire: env.DATABASE_POOL_ACQUIRE_MS,
    },
  });

  return cachedConnection;
}

/**
 * Test-only escape hatch: clears the cached instance so the next
 * `getConnection()` call builds a fresh one (e.g. between test files
 * pointed at different disposable databases). Never called from
 * application code.
 */
export function resetConnectionForTests(): void {
  cachedConnection = null;
}

/** Closes the pooled connection and clears the cache. */
export async function closeConnection(): Promise<void> {
  if (cachedConnection) {
    await cachedConnection.close();
    cachedConnection = null;
  }
}
