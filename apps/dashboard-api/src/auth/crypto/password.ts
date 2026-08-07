import * as argon2 from "argon2";

/**
 * argon2id password hashing for the emergency-admin local login path
 * (ADR-0009, knowledge/05: "password hashed with argon2id"). `argon2.hash`
 * produces a self-describing encoded string (algorithm, params, salt, and
 * hash all packed together) — no separate salt column is needed.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, { type: argon2.argon2id });
}

/** Never throws on a mismatched/malformed hash — a verification failure and a malformed-hash error both mean "reject the login." */
export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}
