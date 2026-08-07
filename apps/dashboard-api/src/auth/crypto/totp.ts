import { authenticator as defaultAuthenticator } from "otplib";

/**
 * `authenticator.clone()` rather than mutating the shared `otplib` default
 * export in place — `authenticator` is a module-level singleton, and
 * setting options directly on it would silently change behavior for any
 * other code in this process that imports the same default instance.
 * `window: 1` allows ±1 time step (±30s) of clock drift between server and
 * authenticator app, a standard, narrow tolerance — not the otplib default
 * of 0, which is unforgiving of any drift at all.
 */
const authenticator = defaultAuthenticator.clone({ window: 1 });

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/** Never throws on a malformed token/secret — treated the same as "incorrect code." */
export function verifyTotpToken(token: string, secret: string): boolean {
  try {
    return authenticator.check(token, secret);
  } catch {
    return false;
  }
}

/** `otpauth://` URI for the enrollment QR code — displayed once at provisioning time, never persisted. */
export function buildTotpKeyUri(accountName: string, issuer: string, secret: string): string {
  return authenticator.keyuri(accountName, issuer, secret);
}
