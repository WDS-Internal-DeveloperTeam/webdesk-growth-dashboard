import type { ExecutionContext } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { AuthEnv } from "../config/auth-env.js";
import { OriginCheckGuard } from "./origin-check.guard.js";

const env = { WEB_APP_ORIGIN: "https://dashboard.example.com" } as AuthEnv;

function contextWithHeaders(headers: Record<string, string | undefined>): ExecutionContext {
  const request = { header: (name: string) => headers[name.toLowerCase()] };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal fake ExecutionContext; only switchToHttp().getRequest() is exercised.
  } as any;
}

describe("OriginCheckGuard", () => {
  const guard = new OriginCheckGuard(env);

  it("allows a request whose Origin matches WEB_APP_ORIGIN exactly", () => {
    const context = contextWithHeaders({ origin: "https://dashboard.example.com" });
    expect(guard.canActivate(context)).toBe(true);
  });

  it("allows a request with no Origin but a matching Referer", () => {
    const context = contextWithHeaders({ referer: "https://dashboard.example.com/auth/emergency" });
    expect(guard.canActivate(context)).toBe(true);
  });

  it("rejects a request with neither Origin nor Referer", () => {
    const context = contextWithHeaders({});
    expect(() => guard.canActivate(context)).toThrow(/Missing Origin\/Referer/);
  });

  it("rejects a cross-origin Origin header", () => {
    const context = contextWithHeaders({ origin: "https://evil.example.com" });
    expect(() => guard.canActivate(context)).toThrow(/Cross-origin/);
  });

  it("rejects a malformed Origin header", () => {
    const context = contextWithHeaders({ origin: "not a url" });
    expect(() => guard.canActivate(context)).toThrow(/Malformed/);
  });

  it("is not fooled by a same-origin-prefixed but different-origin value", () => {
    // e.g. an attacker-controlled https://dashboard.example.com.evil.com
    const context = contextWithHeaders({ origin: "https://dashboard.example.com.evil.com" });
    expect(() => guard.canActivate(context)).toThrow(/Cross-origin/);
  });

  it("ignores a path/query difference on Referer — only the origin component is compared", () => {
    const context = contextWithHeaders({
      referer: "https://dashboard.example.com/some/deep/path?query=1",
    });
    expect(guard.canActivate(context)).toBe(true);
  });
});
