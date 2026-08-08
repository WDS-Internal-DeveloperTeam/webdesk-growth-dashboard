import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { PermissionGuard } from "./permission.guard.js";
import type { AuthorizationService } from "./authorization.service.js";
import type { RequiredPermission } from "./require-permission.decorator.js";

function contextWithAuthUser(authUser: AuthenticatedRequest["authUser"]): ExecutionContext {
  const request: AuthenticatedRequest = { authUser } as AuthenticatedRequest;
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => (): void => undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal fake ExecutionContext.
  } as any;
}

describe("PermissionGuard", () => {
  it("fails closed (500) when the route has no @RequirePermission at all", async () => {
    const reflector = { get: vi.fn().mockReturnValue(undefined) };
    const authorization = { evaluate: vi.fn(), recordAccessDenied: vi.fn() };
    const guard = new PermissionGuard(
      reflector as unknown as Reflector,
      authorization as unknown as AuthorizationService,
    );

    await expect(
      guard.canActivate(contextWithAuthUser({ id: "user-1", sessionId: "s1" })),
    ).rejects.toThrow(/no @RequirePermission/);
    expect(authorization.evaluate).not.toHaveBeenCalled();
  });

  it("rejects when SessionGuard hasn't run (no request.authUser)", async () => {
    const required: RequiredPermission = { moduleKey: "business_knowledge", action: "view" };
    const reflector = { get: vi.fn().mockReturnValue(required) };
    const authorization = { evaluate: vi.fn(), recordAccessDenied: vi.fn() };
    const guard = new PermissionGuard(
      reflector as unknown as Reflector,
      authorization as unknown as AuthorizationService,
    );

    await expect(guard.canActivate(contextWithAuthUser(undefined))).rejects.toThrow(
      /Authentication required/,
    );
    expect(authorization.evaluate).not.toHaveBeenCalled();
  });

  it("denies with a 403 and records the denial when AuthorizationService.evaluate() denies", async () => {
    const required: RequiredPermission = { moduleKey: "users_roles", action: "edit" };
    const reflector = { get: vi.fn().mockReturnValue(required) };
    const authorization = {
      evaluate: vi.fn().mockResolvedValue({ allowed: false, reasonCode: "no_grant" }),
      recordAccessDenied: vi.fn(),
    };
    const guard = new PermissionGuard(
      reflector as unknown as Reflector,
      authorization as unknown as AuthorizationService,
    );

    await expect(
      guard.canActivate(contextWithAuthUser({ id: "user-1", sessionId: "s1" })),
    ).rejects.toThrow(/Missing permission: users_roles:edit/);
    expect(authorization.recordAccessDenied).toHaveBeenCalledWith(
      "user-1",
      "users_roles",
      "edit",
      "no_grant",
    );
  });

  it("allows through and checks the correct user/module/action when granted, without recording a denial", async () => {
    const required: RequiredPermission = { moduleKey: "business_knowledge", action: "view" };
    const reflector = { get: vi.fn().mockReturnValue(required) };
    const authorization = {
      evaluate: vi.fn().mockResolvedValue({ allowed: true, reasonCode: null }),
      recordAccessDenied: vi.fn(),
    };
    const guard = new PermissionGuard(
      reflector as unknown as Reflector,
      authorization as unknown as AuthorizationService,
    );

    const result = await guard.canActivate(contextWithAuthUser({ id: "user-1", sessionId: "s1" }));

    expect(result).toBe(true);
    expect(authorization.evaluate).toHaveBeenCalledWith(
      "user-1",
      "business_knowledge",
      "view",
      undefined,
    );
    expect(authorization.recordAccessDenied).not.toHaveBeenCalled();
  });
});
