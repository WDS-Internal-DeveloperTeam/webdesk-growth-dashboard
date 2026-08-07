import type { Sequelize, Transaction } from "sequelize";
import { getConnection } from "./connection.js";

/**
 * Runs `fn` inside a managed Sequelize transaction: commits automatically
 * if `fn` resolves, rolls back automatically if it throws/rejects. No
 * ambient/implicit transaction propagation — callers that need multiple
 * repository calls in one transaction pass the `Transaction` handle through
 * explicitly (docs/task-packages/phase-1b-database-foundation.md §15).
 */
export async function withTransaction<T>(
  fn: (transaction: Transaction) => Promise<T>,
  connection: Sequelize = getConnection(),
): Promise<T> {
  return connection.transaction(fn);
}
