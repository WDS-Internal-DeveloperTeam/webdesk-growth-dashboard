import { describe, expect, it } from "vitest";
import { authEnvSchema, loadAuthEnv } from "./auth-env.js";

const validBase = {
  GOOGLE_OAUTH_CLIENT_ID: "test-client-id",
  GOOGLE_OAUTH_CLIENT_SECRET: "test-client-secret",
  GOOGLE_OAUTH_REDIRECT_URI: "https://dashboard.example.com/auth/google/callback",
  WEB_APP_ORIGIN: "https://dashboard.example.com",
  TOTP_ENCRYPTION_KEY: "a".repeat(64),
};

describe("loadAuthEnv", () => {
  it("requires the Google OAuth client fields", () => {
    expect(() => loadAuthEnv({})).toThrow(/GOOGLE_OAUTH_CLIENT_ID/);
  });

  it("requires a well-formed redirect URI", () => {
    const result = authEnvSchema.safeParse({
      ...validBase,
      GOOGLE_OAUTH_REDIRECT_URI: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("requires a 64-hex-character TOTP encryption key", () => {
    const tooShort = authEnvSchema.safeParse({ ...validBase, TOTP_ENCRYPTION_KEY: "abc" });
    expect(tooShort.success).toBe(false);

    const nonHex = authEnvSchema.safeParse({ ...validBase, TOTP_ENCRYPTION_KEY: "g".repeat(64) });
    expect(nonHex.success).toBe(false);
  });

  it("applies defaults for issuer, cookies, lockout, and session lifetimes", () => {
    const env = loadAuthEnv(validBase);
    expect(env.GOOGLE_OAUTH_ISSUER_URL).toBe("https://accounts.google.com");
    expect(env.GOOGLE_WORKSPACE_ALLOWED_DOMAINS).toEqual(["webdesksolution.com", "webdeskinc.com"]);
    expect(env.SESSION_COOKIE_NAME).toBe("wds_session");
    expect(env.SESSION_COOKIE_SECURE).toBe(true);
    expect(env.SESSION_MAX_AGE_SECONDS).toBe(7 * 24 * 3600);
    expect(env.SESSION_PENDING_MFA_MAX_AGE_SECONDS).toBe(300);
    expect(env.OIDC_TRANSACTION_COOKIE_NAME).toBe("wds_oidc_txn");
    expect(env.AUTH_LOCKOUT_MAX_ATTEMPTS).toBe(5);
  });

  it("parses a custom allowed-domain list, trimmed and lowercased", () => {
    const env = loadAuthEnv({
      ...validBase,
      GOOGLE_WORKSPACE_ALLOWED_DOMAINS: " Example.com , Other.COM ,",
    });
    expect(env.GOOGLE_WORKSPACE_ALLOWED_DOMAINS).toEqual(["example.com", "other.com"]);
  });

  it("rejects a session max age beyond the seven-day cap", () => {
    const result = authEnvSchema.safeParse({
      ...validBase,
      SESSION_MAX_AGE_SECONDS: String(8 * 24 * 3600),
    });
    expect(result.success).toBe(false);
  });
});
