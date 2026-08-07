import { createHash, randomBytes } from "node:crypto";

/**
 * Session tokens are opaque, cryptographically random, high-entropy values
 * — never a self-contained JWT (knowledge/05, docs/task-packages/phase-1c-authentication-sessions.md
 * §4's forbidden-actions). Only the SHA-256 hash is persisted
 * (`packages/database`'s `sessions.token_hash`); the raw token exists only
 * in the httpOnly cookie the browser holds and the moment it's minted here
 * — a database compromise alone cannot be used to hijack a live session.
 * SHA-256 (not a slow password hash like argon2) is appropriate here: the
 * token already has 256 bits of entropy, so there is no brute-force risk
 * to slow down, unlike a human-chosen password.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
