import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM encryption for TOTP secrets at rest (NODE-103, knowledge/05:
 * "TOTP secret encrypted at rest ... with the same AES-256-GCM-plus-
 * secret-manager-key pattern the base skill already specifies for any
 * persisted secret"). The plaintext TOTP secret is never persisted — only
 * this packed ciphertext (`packages/database`'s
 * `emergency_admin_credentials.totp_secret_encrypted` column).
 *
 * Packed format: `${ivHex}:${authTagHex}:${ciphertextHex}` — a fresh random
 * 96-bit IV per encryption (GCM's recommended nonce size), the GCM
 * authentication tag (detects any tampering with the ciphertext), and the
 * ciphertext itself, all hex-encoded and colon-joined into one column.
 */
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;

export function encryptTotpSecret(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decryptTotpSecret(packed: string, keyHex: string): string {
  const parts = packed.split(":");
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted TOTP secret: expected iv:authTag:ciphertext");
  }
  const [ivHex, authTagHex, ciphertextHex] = parts as [string, string, string];
  const key = Buffer.from(keyHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextHex, "hex")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
