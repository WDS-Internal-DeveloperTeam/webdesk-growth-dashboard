import { describe, expect, it } from "vitest";
import { getSentryConfig } from "./sentry.js";

describe("getSentryConfig", () => {
  it("is disabled when no DSN is configured, never sending real events", () => {
    const config = getSentryConfig({
      dsn: undefined,
      environment: "production",
      release: "abc1234",
    });
    expect(config.enabled).toBe(false);
    expect(config.dsn).toBeUndefined();
  });

  it("is disabled for an empty-string DSN too", () => {
    const config = getSentryConfig({ dsn: "", environment: "production", release: "abc1234" });
    expect(config.enabled).toBe(false);
  });

  it("is enabled once a real DSN is provided, passing environment/release through", () => {
    const config = getSentryConfig({
      dsn: "https://examplePublicKey@o0.ingest.sentry.io/0",
      environment: "production",
      release: "abc1234",
    });
    expect(config.enabled).toBe(true);
    expect(config.dsn).toBe("https://examplePublicKey@o0.ingest.sentry.io/0");
    expect(config.environment).toBe("production");
    expect(config.release).toBe("abc1234");
  });
});
