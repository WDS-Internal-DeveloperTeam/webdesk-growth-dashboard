import { describe, expect, it } from "vitest";
import { databaseEnvSchema, loadDatabaseEnv } from "./env.js";

describe("loadDatabaseEnv", () => {
  it("requires DATABASE_URL", () => {
    expect(() => loadDatabaseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("applies serverless-aware pool defaults", () => {
    const env = loadDatabaseEnv({ DATABASE_URL: "postgres://localhost:5432/test" });
    expect(env.DATABASE_POOL_MAX).toBe(2);
    expect(env.DATABASE_POOL_MIN).toBe(0);
    expect(env.DATABASE_POOL_IDLE_MS).toBe(10_000);
    expect(env.DATABASE_SSL).toBe(true);
  });

  it("parses DATABASE_SSL=false to a boolean", () => {
    const env = loadDatabaseEnv({
      DATABASE_URL: "postgres://localhost:5432/test",
      DATABASE_SSL: "false",
    });
    expect(env.DATABASE_SSL).toBe(false);
  });

  it("rejects a non-numeric pool size", () => {
    const result = databaseEnvSchema.safeParse({
      DATABASE_URL: "postgres://localhost:5432/test",
      DATABASE_POOL_MAX: "not-a-number",
    });
    expect(result.success).toBe(false);
  });
});
