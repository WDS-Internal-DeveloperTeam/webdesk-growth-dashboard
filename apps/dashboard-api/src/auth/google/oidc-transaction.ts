import type { Request, Response } from "express";
import type { AuthEnv } from "../config/auth-env.js";

/** The OAuth `state`/`nonce`/PKCE `code_verifier` generated at `/auth/google/start`, needed again at `/auth/google/callback`. */
export interface OidcTransaction {
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
}

function isOidcTransaction(value: unknown): value is OidcTransaction {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).state === "string" &&
    typeof (value as Record<string, unknown>).nonce === "string" &&
    typeof (value as Record<string, unknown>).codeVerifier === "string"
  );
}

/**
 * Carried between `/auth/google/start` and `/auth/google/callback` in a
 * short-lived cookie — **must be SameSite=Lax, not Strict**. It is read on
 * the top-level navigation Google itself sends the browser back on; a
 * Strict cookie is not sent on a cross-site top-level navigation, which
 * would silently break every login. No signing/HMAC: the state/nonce
 * values are themselves cryptographically random (openid-client's
 * `randomState`/`randomNonce`), httpOnly keeps client-side JS from reading
 * them, and a tampered cookie only breaks the tamperer's own login attempt
 * (openid-client rejects the mismatched state/nonce/verifier) — it grants
 * no elevated access to anyone.
 */
export function setOidcTransactionCookie(
  res: Response,
  transaction: OidcTransaction,
  env: AuthEnv,
): void {
  res.cookie(env.OIDC_TRANSACTION_COOKIE_NAME, JSON.stringify(transaction), {
    httpOnly: true,
    secure: env.SESSION_COOKIE_SECURE,
    sameSite: "lax",
    maxAge: env.OIDC_TRANSACTION_MAX_AGE_SECONDS * 1000,
    path: "/auth/google",
  });
}

/**
 * `"missing"` (no cookie sent at all) is the genuinely-expired case — the cookie's own `maxAge`
 * elapsed, or the browser never carried it back (e.g. a bookmarked/replayed callback URL).
 * `"invalid"` (a cookie WAS sent but doesn't parse as JSON, or doesn't match `OidcTransaction`'s
 * shape) is a different, real anomaly — corruption, a `SameSite`/proxy quirk delivering a stale or
 * foreign cookie, or a future schema change to this cookie's own shape — and the caller should
 * treat it as a genuine error, not silently fold it into "expired" (see
 * `GoogleAuthController#callback`'s use of this distinction, and
 * `docs/implementation/session-exchange.md` §9 for the incident class this closes). `reason`
 * distinguishes the two ways a cookie can be "invalid" — `"parse"` (not valid JSON at all, most
 * likely truncation/corruption in transit) vs. `"shape"` (valid JSON, wrong/missing fields, most
 * likely a real schema-drift bug) — so the caller's log line can actually say which one happened,
 * instead of a single undifferentiated "malformed" that leaves on-call unable to tell transport
 * corruption from a real code bug.
 */
export type OidcTransactionReadResult =
  | { readonly status: "missing" }
  | { readonly status: "invalid"; readonly reason: "parse" | "shape" }
  | { readonly status: "ok"; readonly transaction: OidcTransaction };

export function readOidcTransactionCookie(req: Request, env: AuthEnv): OidcTransactionReadResult {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const raw = cookies?.[env.OIDC_TRANSACTION_COOKIE_NAME];
  if (!raw) {
    return { status: "missing" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "invalid", reason: "parse" };
  }
  return isOidcTransaction(parsed)
    ? { status: "ok", transaction: parsed }
    : { status: "invalid", reason: "shape" };
}

export function clearOidcTransactionCookie(res: Response, env: AuthEnv): void {
  res.clearCookie(env.OIDC_TRANSACTION_COOKIE_NAME, { path: "/auth/google" });
}
