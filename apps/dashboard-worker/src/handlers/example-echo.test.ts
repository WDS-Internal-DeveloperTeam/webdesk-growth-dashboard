import { describe, expect, it } from "vitest";
import { toIdempotencyKey } from "../handler-types.js";
import { exampleEchoHandler } from "./example-echo.js";

function testContext(attempt = 1) {
  return {
    jobId: "example-1",
    jobType: "example-echo",
    attempt,
    idempotencyKey: toIdempotencyKey("example-1"),
    enqueuedAt: new Date().toISOString(),
  };
}

describe("exampleEchoHandler (non-production example)", () => {
  it("echoes the message on the success path", async () => {
    const result = await exampleEchoHandler(
      { message: "hello", simulate: "success" },
      testContext(),
    );
    expect(result.outcome).toBe("success");
    if (result.outcome === "success") {
      expect(result.output.echoed).toBe("hello");
    }
  });

  it("returns a retry result when asked to simulate retry", async () => {
    const result = await exampleEchoHandler(
      { message: "hello", simulate: "retry" },
      testContext(2),
    );
    expect(result.outcome).toBe("retry");
  });

  it("returns a permanent failure when asked to simulate one", async () => {
    const result = await exampleEchoHandler(
      { message: "hello", simulate: "permanent-failure" },
      testContext(),
    );
    expect(result.outcome).toBe("failure");
    if (result.outcome === "failure") {
      expect(result.permanent).toBe(true);
    }
  });

  it("rejects an invalid payload as a permanent failure", async () => {
    const result = await exampleEchoHandler(
      // @ts-expect-error deliberately invalid payload to test validation
      { message: "" },
      testContext(),
    );
    expect(result.outcome).toBe("failure");
  });
});
