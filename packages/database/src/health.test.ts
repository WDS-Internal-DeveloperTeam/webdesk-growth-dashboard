import type { Sequelize } from "sequelize";
import { describe, expect, it, vi } from "vitest";
import { checkDatabaseHealth } from "./health.js";

describe("checkDatabaseHealth", () => {
  it("reports ok when the query succeeds", async () => {
    const query = vi.fn().mockResolvedValue([]);
    const fakeConnection = { query } as unknown as Sequelize;

    const result = await checkDatabaseHealth(fakeConnection);

    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(query).toHaveBeenCalledWith("SELECT 1");
  });

  it("never throws — reports ok:false with the error message when the query fails", async () => {
    const query = vi.fn().mockRejectedValue(new Error("connection refused"));
    const fakeConnection = { query } as unknown as Sequelize;

    const result = await checkDatabaseHealth(fakeConnection);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("connection refused");
  });
});
