import { describe, expect, it } from "vitest";
import { err, ok, type Result } from "./index.js";

describe("Result helpers", () => {
  it("ok() produces a success result", () => {
    const result: Result<number> = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(42);
    }
  });

  it("err() produces a failure result", () => {
    const result: Result<number, string> = err("boom");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("boom");
    }
  });
});
