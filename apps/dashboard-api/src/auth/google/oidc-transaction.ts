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

export function readOidcTransactionCookie(req: Request, env: AuthEnv): OidcTransaction | null {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const raw = cookies?.[env.OIDC_TRANSACTION_COOKIE_NAME];
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return isOidcTransaction(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearOidcTransactionCookie(res: Response, env: AuthEnv): void {
  res.clearCookie(env.OIDC_TRANSACTION_COOKIE_NAME, { path: "/auth/google" });
}
