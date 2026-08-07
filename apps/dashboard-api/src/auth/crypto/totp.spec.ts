import { authenticator } from "otplib";
import { describe, expect, it } from "vitest";
import { buildTotpKeyUri, generateTotpSecret, verifyTotpToken } from "./totp.js";

describe("TOTP (otplib, Google-Authenticator-compatible)", () => {
  it("generates a Base32 secret", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
  });

  it("verifies a correctly generated current token", () => {
    const secret = generateTotpSecret();
    const token = authenticator.generate(secret);
    expect(verifyTotpToken(token, secret)).toBe(true);
  });

  it("rejects an incorrect token", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpToken("000000", secret)).toBe(false);
  });

  it("rejects a token generated against a different secret", () => {
    const secretA = generateTotpSecret();
    const secretB = generateTotpSecret();
    const tokenForB = authenticator.generate(secretB);
    expect(verifyTotpToken(tokenForB, secretA)).toBe(false);
  });

  it("fails closed on a malformed token rather than throwing", () => {
    const secret = generateTotpSecret();
    expect(verifyTotpToken("not-numeric", secret)).toBe(false);
  });

  it("builds a valid otpauth:// key URI", () => {
    const secret = generateTotpSecret();
    const uri = buildTotpKeyUri("admin@webdesksolution.com", "WebDesk Dashboard", secret);
    expect(uri.startsWith("otpauth://totp/")).toBe(true);
    expect(uri).toContain(encodeURIComponent("WebDesk Dashboard"));
  });

  it("does not mutate otplib's shared default authenticator instance (window stays at its own default)", () => {
    expect(authenticator.allOptions().window).not.toEqual([1, 1]);
  });
});
