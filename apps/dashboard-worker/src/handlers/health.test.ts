import { describe, expect, it } from "vitest";
import { toIdempotencyKey } from "../handler-types.js";
import { healthHandler } from "./health.js";

describe("healthHandler", () => {
  it("reports ok status for this service", async () => {
    const result = await healthHandler(
      {},
      {
        jobId: "health-check",
        jobType: "health",
        attempt: 1,
        idempotencyKey: toIdempotencyKey("health-check-1"),
        enqueuedAt: new Date().toISOString(),
      },
    );
    expect(result.outcome).toBe("success");
    if (result.outcome === "success") {
      expect(result.output.status).toBe("ok");
      expect(result.output.service).toBe("dashboard-worker");
    }
  });
});
