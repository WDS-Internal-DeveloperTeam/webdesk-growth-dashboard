import { describe, expect, it } from "vitest";
import type { JobQueueAdapter } from "./adapters.js";

describe("adapter interfaces (Phase 1A — type shape only, no implementation)", () => {
  it("a structurally-conforming mock satisfies JobQueueAdapter", async () => {
    const mock: JobQueueAdapter = {
      enqueue: async (_jobType, _payload) => ({ jobId: "test-job-id" }),
    };
    const result = await mock.enqueue("test", {});
    expect(result.jobId).toBe("test-job-id");
  });
});
