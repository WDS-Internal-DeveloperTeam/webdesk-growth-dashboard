import { describe, expect, it } from "vitest";
import { healthCheckResultSchema, paginationParamsSchema } from "./index.js";

describe("paginationParamsSchema", () => {
  it("defaults page and pageSize when omitted", () => {
    const result = paginationParamsSchema.parse({});
    expect(result).toEqual({ page: 1, pageSize: 20 });
  });

  it("rejects a pageSize above the max", () => {
    const result = paginationParamsSchema.safeParse({ pageSize: 1000 });
    expect(result.success).toBe(false);
  });
});

describe("healthCheckResultSchema", () => {
  it("accepts a valid health-check payload", () => {
    const result = healthCheckResultSchema.safeParse({
      status: "ok",
      service: "dashboard-api",
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid status value", () => {
    const result = healthCheckResultSchema.safeParse({
      status: "not-a-real-status",
      service: "dashboard-api",
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});
