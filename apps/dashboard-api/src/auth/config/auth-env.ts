import { loadEnv } from "@webdesk/configuration";
import { z } from "zod";

/**
 * Read and validated inside `dashboard-api` only — the auth contract
 * (docs/contracts/google-workspace-auth-contract.md "Trust boundary") makes
 * `dashboard-api` the sole owner of OIDC callback handling and session
 * issuance, so these secrets never need to exist anywhere else. Not part of
 * `packages/configuration`'s `baseEnvSchema` (that package is Phase 1A
 * foundation, deliberately generic) and not `packages/database`'s env (that
 * package owns only `DATABASE_URL`-shaped connection config, per WDS-011).
 */
export const authEnvSchema = z.object({
  /** Google Workspace OAuth 2.0 client, per ADR-0008. Real values are an unconfirmed setup-time input (docs/project-state/setup-input-register.md) — a test/mock value is used in every test in this repo. */
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1, "GOOGLE_OAUTH_CLIENT_ID is required"),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1, "GOOGLE_OAUTH_CLIENT_SECRET is required"),
  GOOGLE_OAUTH_REDIRECT_URI: z.string().url("GOOGLE_OAUTH_REDIRECT_URI must be an absolute URL"),
  /** Overridable only for tests against a mock OIDC provider — never for a real deployment. */
  GOOGLE_OAUTH_ISSUER_URL: z.string().url().default("https://accounts.google.com"),
  /**
   * The `dashboard-web` frontend's own origin (scheme+host+port, no path).
   * Used as the CSRF allowlist for state-changing endpoints
   * (../common/origin-check.guard.ts) — deliberately a configured trusted
   * value, not derived from the incoming request's own Host header, since
   * a forged cross-site request always has a correct Host (it's addressed
   * to the right server) and comparing Origin-to-Host proves nothing.
   */
  WEB_APP_ORIGIN: z.string().url("WEB_APP_ORIGIN must be an absolute URL"),
  /** Comma-separated. Both WebDesk domains are treated as one organization (ADR-0008, knowledge/05) — no tenant separation on domain alone. */
  GOOGLE_WORKSPACE_ALLOWED_DOMAINS: z
    .string()
    .min(1)
    .default("webdesksolution.com,webdeskinc.com")
    .transform((value) =>
      value
        .split(",")
        .map((domain) => domain.trim().toLowerCase())
        .filter((domain) => domain.length > 0),
    ),

  /** Dashboard-issued session cookie (knowledge/05 "Session, downstream of SSO"). */
  SESSION_COOKIE_NAME: z.string().min(1).default("wds_session"),
  SESSION_COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  /** Absolute cap, per knowledge/05: "Maximum seven-day session expiry." */
  SESSION_MAX_AGE_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(7 * 24 * 3600)
    .default(7 * 24 * 3600),
  /** The password-verified-but-not-yet-TOTP-verified emergency-login window (§"Local emergency-administrator accounts"). Short by design. */
  SESSION_PENDING_MFA_MAX_AGE_SECONDS: z.coerce.number().int().min(30).max(900).default(300),

  /**
   * Short-lived cookie carrying the OAuth `state`/`nonce`/PKCE `code_verifier`
   * between `/auth/google/start` and `/auth/google/callback`. Must be
   * SameSite=Lax, not Strict — it is read on the top-level navigation Google
   * itself initiates back to this app, which a Strict cookie would not be
   * sent on.
   */
  OIDC_TRANSACTION_COOKIE_NAME: z.string().min(1).default("wds_oidc_txn"),
  OIDC_TRANSACTION_MAX_AGE_SECONDS: z.coerce.number().int().min(60).max(900).default(300),

  /**
   * 32-byte (64 hex char) AES-256-GCM key for encrypting TOTP secrets at
   * rest (NODE-103, knowledge/05). An unconfirmed setup-time input for real
   * deployments; every test in this repo generates its own throwaway key.
   */
  TOTP_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "TOTP_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)"),

  /** Account lockout / rate limiting for the emergency-local login path (base skill security/01-owasp-api.md baseline, applied per knowledge/05). */
  AUTH_LOCKOUT_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  AUTH_LOCKOUT_WINDOW_SECONDS: z.coerce.number().int().min(1).default(900),
  AUTH_LOCKOUT_DURATION_SECONDS: z.coerce.number().int().min(1).default(900),
});

export type AuthEnv = z.infer<typeof authEnvSchema>;

export function loadAuthEnv(source: Record<string, string | undefined> = process.env): AuthEnv {
  return loadEnv(authEnvSchema, source);
}
