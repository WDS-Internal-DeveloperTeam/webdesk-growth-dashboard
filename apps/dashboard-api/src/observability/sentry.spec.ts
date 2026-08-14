import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryInit = vi.fn();
const sentryCaptureException = vi.fn();

vi.mock("@sentry/node", () => ({
  init: (...args: unknown[]) => sentryInit(...args),
  captureException: (...args: unknown[]) => sentryCaptureException(...args),
}));

describe("observability/sentry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("never calls Sentry.init when no DSN is configured", async () => {
    const { initSentry } = await import("./sentry.js");
    initSentry(undefined);
    expect(sentryInit).not.toHaveBeenCalled();
  });

  it("never reports an exception when Sentry was never initialized (unconfigured)", async () => {
    const { initSentry, captureException } = await import("./sentry.js");
    initSentry(undefined);
    captureException(new Error("boom"));
    expect(sentryCaptureException).not.toHaveBeenCalled();
  });

  it("initializes Sentry once a real DSN is provided", async () => {
    const { initSentry } = await import("./sentry.js");
    initSentry("https://key@o0.ingest.sentry.io/0");
    expect(sentryInit).toHaveBeenCalledTimes(1);
    expect(sentryInit).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: "https://key@o0.ingest.sentry.io/0" }),
    );
  });

  it("reports an exception once configured", async () => {
    const { initSentry, captureException } = await import("./sentry.js");
    initSentry("https://key@o0.ingest.sentry.io/0");
    const error = new Error("boom");
    captureException(error);
    expect(sentryCaptureException).toHaveBeenCalledWith(error);
  });
});
