import type { Request } from "express";
import { describe, expect, it } from "vitest";
import type { AuthEnv } from "../config/auth-env.js";
import { readOidcTransactionCookie } from "./oidc-transaction.js";

describe("readOidcTransactionCookie", () => {
  const env = { OIDC_TRANSACTION_COOKIE_NAME: "wds_oidc_txn" } as AuthEnv;

  function requestWithCookie(raw: string | undefined): Request {
    return {
      cookies: raw === undefined ? {} : { [env.OIDC_TRANSACTION_COOKIE_NAME]: raw },
    } as Request;
  }

  it("returns status: 'missing' when no cookie was sent at all", () => {
    expect(readOidcTransactionCookie(requestWithCookie(undefined), env)).toEqual({
      status: "missing",
    });
  });

  it("returns status: 'ok' with the parsed transaction for a well-formed cookie", () => {
    const transaction = { state: "s", nonce: "n", codeVerifier: "v" };
    expect(readOidcTransactionCookie(requestWithCookie(JSON.stringify(transaction)), env)).toEqual({
      status: "ok",
      transaction,
    });
  });

  it("returns status: 'invalid', reason: 'parse' — not 'missing' — for a cookie that isn't valid JSON", () => {
    expect(readOidcTransactionCookie(requestWithCookie("not-json{"), env)).toEqual({
      status: "invalid",
      reason: "parse",
    });
  });

  it("returns status: 'invalid', reason: 'shape' — not 'missing' — for a cookie that parses but is missing required fields", () => {
    expect(
      readOidcTransactionCookie(requestWithCookie(JSON.stringify({ state: "s" })), env),
    ).toEqual({ status: "invalid", reason: "shape" });
  });

  it("returns status: 'invalid', reason: 'shape' for a cookie whose fields are the wrong type", () => {
    const malformed = { state: 1, nonce: "n", codeVerifier: "v" };
    expect(readOidcTransactionCookie(requestWithCookie(JSON.stringify(malformed)), env)).toEqual({
      status: "invalid",
      reason: "shape",
    });
  });
});
