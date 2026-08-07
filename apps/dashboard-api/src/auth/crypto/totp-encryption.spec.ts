import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptTotpSecret, encryptTotpSecret } from "./totp-encryption.js";

const key = randomBytes(32).toString("hex");

describe("TOTP secret encryption (AES-256-GCM)", () => {
  it("round-trips a secret through encrypt/decrypt", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const packed = encryptTotpSecret(secret, key);
    expect(packed.split(":")).toHaveLength(3);
    expect(decryptTotpSecret(packed, key)).toBe(secret);
  });

  it("produces a different IV (and ciphertext) on every call — never deterministic", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const first = encryptTotpSecret(secret, key);
    const second = encryptTotpSecret(secret, key);
    expect(first).not.toBe(second);
  });

  it("fails closed if decrypted with the wrong key", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const packed = encryptTotpSecret(secret, key);
    const wrongKey = randomBytes(32).toString("hex");
    expect(() => decryptTotpSecret(packed, wrongKey)).toThrow();
  });

  it("fails closed if the ciphertext has been tampered with", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const packed = encryptTotpSecret(secret, key);
    const [iv, tag, ciphertext] = packed.split(":");
    const tamperedByte = (parseInt(ciphertext!.slice(0, 2), 16) ^ 0xff)
      .toString(16)
      .padStart(2, "0");
    const tampered = `${iv}:${tag}:${tamperedByte}${ciphertext!.slice(2)}`;
    expect(() => decryptTotpSecret(tampered, key)).toThrow();
  });

  it("rejects a malformed packed value", () => {
    expect(() => decryptTotpSecret("not-the-right-shape", key)).toThrow(/Malformed/);
  });
});
