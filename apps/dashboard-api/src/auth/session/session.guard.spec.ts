import type { ExecutionContext } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { AuthEnv } from "../config/auth-env.js";
import type { SessionService } from "./session.service.js";
import { SessionGuard } from "./session.guard.js";

const env = { SESSION_COOKIE_NAME: "wds_session" } as AuthEnv;

function contextWithCookies(cookies: Record<string, string | undefined>): ExecutionContext {
  const request = { cookies };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal fake ExecutionContext; only switchToHttp().getRequest() is exercised.
  } as any;
}

describe("SessionGuard", () => {
  it("rejects a request with no session cookie", async () => {
    const sessionService = { validate: vi.fn() };
    const guard = new SessionGuard(env, sessionService as unknown as SessionService);
    await expect(guard.canActivate(contextWithCookies({}))).rejects.toThrow(/No active session/);
    expect(sessionService.validate).not.toHaveBeenCalled();
  });

  it("rejects when SessionService.validate finds nothing valid", async () => {
    const sessionService = { validate: vi.fn().mockResolvedValue(null) };
    const guard = new SessionGuard(env, sessionService as unknown as SessionService);
    await expect(
      guard.canActivate(contextWithCookies({ wds_session: "some-token" })),
    ).rejects.toThrow(/No active session/);
  });

  it("populates request.authUser and allows the request through on a valid session", async () => {
    const sessionService = {
      validate: vi.fn().mockResolvedValue({ id: "session-1", userId: "user-1" }),
    };
    const guard = new SessionGuard(env, sessionService as unknown as SessionService);
    const request: { cookies: Record<string, string>; authUser?: unknown } = {
      cookies: { wds_session: "some-token" },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal fake ExecutionContext.
    } as any;

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.authUser).toEqual({ id: "user-1", sessionId: "session-1" });
  });
});
