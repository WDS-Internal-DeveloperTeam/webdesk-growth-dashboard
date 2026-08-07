import type { Sequelize } from "sequelize";
import { getConnection } from "./connection.js";

/**
 * Proves the connection is genuinely alive with a trivial round-trip query
 * — `getConnection()` alone only constructs the Sequelize instance
 * (construction is lazy, see connection.ts), it never proves connectivity.
 * Never throws: a database failure is reported as `{ ok: false }`, not
 * a crash — matching `dashboard-api`'s existing `/ready` route
 * (apps/dashboard-api/src/health/health.controller.ts), which this
 * function is meant to be wired into (out of scope for this task, §8).
 */
export interface DatabaseHealthResult {
  readonly ok: boolean;
  readonly latencyMs: number;
  readonly error?: string;
}

export async function checkDatabaseHealth(
  connection: Sequelize = getConnection(),
): Promise<DatabaseHealthResult> {
  const start = performance.now();
  try {
    await connection.query("SELECT 1");
    return { ok: true, latencyMs: performance.now() - start };
  } catch (error) {
    return {
      ok: false,
      latencyMs: performance.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
