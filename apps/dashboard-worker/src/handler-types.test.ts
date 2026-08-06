import { describe, expect, it } from "vitest";
import {
  jobSuccess,
  toIdempotencyKey,
  withIdempotency,
  type JobContext,
  type JobHandler,
} from "./handler-types.js";

function testContext(overrides: Partial<JobContext> = {}): JobContext {
  return {
    jobId: "job-1",
    jobType: "test",
    attempt: 1,
    idempotencyKey: toIdempotencyKey("key-1"),
    enqueuedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("toIdempotencyKey", () => {
  it("accepts a non-empty string", () => {
    expect(toIdempotencyKey("abc")).toBe("abc");
  });

  it("rejects an empty string", () => {
    expect(() => toIdempotencyKey("")).toThrow(/must not be empty/);
  });
});

describe("withIdempotency", () => {
  it("only invokes the wrapped handler once per idempotency key", async () => {
    let callCount = 0;
    const handler: JobHandler<{ n: number }, number> = async (payload) => {
      callCount += 1;
      return jobSuccess(payload.n);
    };
    const wrapped = withIdempotency(handler);
    const context = testContext();

    const first = await wrapped({ n: 1 }, context);
    const second = await wrapped({ n: 1 }, context);

    expect(callCount).toBe(1);
    expect(first.outcome).toBe("success");
    expect(second.outcome).toBe("success");
  });

  it("invokes the handler again for a different idempotency key", async () => {
    let callCount = 0;
    const handler: JobHandler<{ n: number }, number> = async (payload) => {
      callCount += 1;
      return jobSuccess(payload.n);
    };
    const wrapped = withIdempotency(handler);

    await wrapped({ n: 1 }, testContext({ idempotencyKey: toIdempotencyKey("a") }));
    await wrapped({ n: 2 }, testContext({ idempotencyKey: toIdempotencyKey("b") }));

    expect(callCount).toBe(2);
  });
});
