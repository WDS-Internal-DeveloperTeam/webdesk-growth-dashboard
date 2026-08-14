import { describe, expect, it } from "vitest";
import { baseEnvSchema, loadEnv } from "./env.js";

describe("loadEnv", () => {
  it("applies defaults when optional variables are absent", () => {
    const env = loadEnv(baseEnvSchema, {});
    expect(env.NODE_ENV).toBe("development");
    expect(env.LOG_LEVEL).toBe("info");
  });

  it("parses a valid PORT", () => {
    const env = loadEnv(baseEnvSchema, { PORT: "3000" });
    expect(env.PORT).toBe(3000);
  });

  it("fails fast with a clear message on an invalid NODE_ENV", () => {
    expect(() => loadEnv(baseEnvSchema, { NODE_ENV: "not-a-real-env" })).toThrow(
      /Environment validation failed/,
    );
  });

  it("leaves SENTRY_DSN undefined when absent, never fabricating one", () => {
    const env = loadEnv(baseEnvSchema, {});
    expect(env.SENTRY_DSN).toBeUndefined();
  });

  it("accepts a real SENTRY_DSN URL when present", () => {
    const env = loadEnv(baseEnvSchema, { SENTRY_DSN: "https://key@o0.ingest.sentry.io/0" });
    expect(env.SENTRY_DSN).toBe("https://key@o0.ingest.sentry.io/0");
  });

  it("fails fast on a malformed SENTRY_DSN", () => {
    expect(() => loadEnv(baseEnvSchema, { SENTRY_DSN: "not-a-url" })).toThrow(
      /Environment validation failed/,
    );
  });
});
