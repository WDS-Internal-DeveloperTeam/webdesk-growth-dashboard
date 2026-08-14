import { describe, expect, it } from "vitest";
import { buildLoggerOptions, DEFAULT_REDACT_PATHS } from "./logging.js";

describe("DEFAULT_REDACT_PATHS", () => {
  it("covers every Phase 1F brief §20 category with a real field-name pattern", () => {
    // Passwords
    expect(DEFAULT_REDACT_PATHS).toContain("*.password");
    // Tokens / session identifiers (the real field name: rawToken)
    expect(DEFAULT_REDACT_PATHS).toContain("*.token");
    expect(DEFAULT_REDACT_PATHS).toContain("*.rawToken");
    // TOTP secrets
    expect(DEFAULT_REDACT_PATHS).toContain("*.totpSecret");
    expect(DEFAULT_REDACT_PATHS).toContain("*.totpSecretEncrypted");
    // OAuth secrets
    expect(DEFAULT_REDACT_PATHS).toContain("*.clientSecret");
    expect(DEFAULT_REDACT_PATHS).toContain("*.GOOGLE_OAUTH_CLIENT_SECRET");
    // SMTP credentials (pattern-ready, no SMTP integration wired yet)
    expect(DEFAULT_REDACT_PATHS).toContain("*.smtpPassword");
    expect(DEFAULT_REDACT_PATHS).toContain("*.SMTP_PASSWORD");
    // Authorization headers / cookies
    expect(DEFAULT_REDACT_PATHS).toContain("req.headers.authorization");
    expect(DEFAULT_REDACT_PATHS).toContain("req.headers.cookie");
    // Secret environment values
    expect(DEFAULT_REDACT_PATHS).toContain("*.DATABASE_URL");
    expect(DEFAULT_REDACT_PATHS).toContain("*.TOTP_ENCRYPTION_KEY");
  });
});

describe("buildLoggerOptions", () => {
  it("stamps the service name into the base log object", () => {
    const options = buildLoggerOptions({ LOG_LEVEL: "info" }, "dashboard-api");
    expect(options.base).toEqual({ service: "dashboard-api" });
  });

  it("reads the level from env and always redacts with a fixed censor value", () => {
    const options = buildLoggerOptions({ LOG_LEVEL: "debug" }, "dashboard-worker");
    expect(options.level).toBe("debug");
    expect(options.redact.censor).toBe("[REDACTED]");
    expect(options.redact.paths).toEqual(DEFAULT_REDACT_PATHS);
  });

  it("always enables timestamps", () => {
    const options = buildLoggerOptions({ LOG_LEVEL: "info" }, "dashboard-api");
    expect(options.timestamp).toBe(true);
  });
});
