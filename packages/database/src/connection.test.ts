import { Sequelize } from "sequelize";
import { afterEach, describe, expect, it } from "vitest";
import { closeConnection, getConnection, resetConnectionForTests } from "./connection.js";

const TEST_ENV = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/test",
  DATABASE_POOL_MAX: 2,
  DATABASE_POOL_MIN: 0,
  DATABASE_POOL_IDLE_MS: 10_000,
  DATABASE_POOL_ACQUIRE_MS: 30_000,
  DATABASE_SSL: false,
} as const;

describe("getConnection", () => {
  afterEach(async () => {
    await closeConnection();
    resetConnectionForTests();
  });

  it("constructs a real Sequelize instance without connecting (construction is lazy)", () => {
    const connection = getConnection(TEST_ENV);
    expect(connection).toBeInstanceOf(Sequelize);
  });

  it("caches the instance across calls within the same process (module-scope singleton)", () => {
    const first = getConnection(TEST_ENV);
    const second = getConnection(TEST_ENV);
    expect(first).toBe(second);
  });

  it("builds a fresh instance after resetConnectionForTests", () => {
    const first = getConnection(TEST_ENV);
    resetConnectionForTests();
    const second = getConnection(TEST_ENV);
    expect(first).not.toBe(second);
  });

  it("applies the configured serverless-aware pool sizing", () => {
    const connection = getConnection(TEST_ENV);
    expect(connection.config.pool?.max).toBe(2);
    expect(connection.config.pool?.min).toBe(0);
  });

  it("omits SSL dialect options when DATABASE_SSL is false (the disposable-test-database exception)", () => {
    const connection = getConnection(TEST_ENV);
    const dialectOptions = (
      connection as unknown as { options: { dialectOptions?: { ssl?: unknown } } }
    ).options.dialectOptions;
    expect(dialectOptions?.ssl).toBeUndefined();
  });

  it("requires SSL by default", () => {
    const connection = getConnection({ ...TEST_ENV, DATABASE_SSL: true });
    const dialectOptions = (
      connection as unknown as {
        options: { dialectOptions?: { ssl?: { require?: boolean } } };
      }
    ).options.dialectOptions;
    expect(dialectOptions?.ssl?.require).toBe(true);
  });
});
