import type { Sequelize, Transaction } from "sequelize";
import { describe, expect, it, vi } from "vitest";
import { withTransaction } from "./transaction.js";

/**
 * Delegation-only unit test — `withTransaction` is a thin wrapper around
 * Sequelize's own managed-transaction API, whose actual commit/rollback
 * semantics are exercised by real Sequelize code, not reimplemented here.
 * Real commit-on-success / rollback-on-throw behavior against a live
 * database is covered by the integration suite
 * (docs/task-packages/phase-1b-database-foundation.md §15/§21 — "verified
 * with a real disposable database, not mocked").
 */
describe("withTransaction", () => {
  it("delegates to the connection's managed transaction API", async () => {
    const fakeTransaction = {} as Transaction;
    const transactionSpy = vi.fn(async (fn: (t: Transaction) => Promise<unknown>) =>
      fn(fakeTransaction),
    );
    const fakeConnection = { transaction: transactionSpy } as unknown as Sequelize;

    const callback = vi.fn(async (t: Transaction) => {
      expect(t).toBe(fakeTransaction);
      return "result";
    });

    const result = await withTransaction(callback, fakeConnection);

    expect(result).toBe("result");
    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(fakeTransaction);
  });

  it("propagates a rejection from the callback (Sequelize rolls back on throw)", async () => {
    const transactionSpy = vi.fn(async (fn: (t: Transaction) => Promise<unknown>) =>
      fn({} as Transaction),
    );
    const fakeConnection = { transaction: transactionSpy } as unknown as Sequelize;

    await expect(
      withTransaction(async () => {
        throw new Error("boom");
      }, fakeConnection),
    ).rejects.toThrow("boom");
  });
});
