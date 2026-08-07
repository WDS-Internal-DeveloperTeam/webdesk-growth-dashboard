import { describe, expect, it } from "vitest";
import { generateSessionToken, hashSessionToken } from "./session-token.js";

describe("session token generation/hashing", () => {
  it("generates a high-entropy, URL-safe opaque token", () => {
    const token = generateSessionToken();
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates a different token every call", () => {
    expect(generateSessionToken()).not.toBe(generateSessionToken());
  });

  it("hashes deterministically — the same token always hashes the same way", () => {
    const token = generateSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it("produces a 64-hex-character SHA-256 digest", () => {
    const hash = hashSessionToken("some-token-value");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("different tokens hash to different values", () => {
    expect(hashSessionToken(generateSessionToken())).not.toBe(
      hashSessionToken(generateSessionToken()),
    );
  });
});
