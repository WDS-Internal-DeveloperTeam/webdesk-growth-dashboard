import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { PermissionGuard } from "./permission.guard.js";
import type { PermissionService } from "./permission.service.js";
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
    const permissionService = { can: vi.fn() };
    const guard = new PermissionGuard(
      reflector as unknown as Reflector,
      permissionService as unknown as PermissionService,
    );

    await expect(
      guard.canActivate(contextWithAuthUser({ id: "user-1", sessionId: "s1" })),
    ).rejects.toThrow(/no @RequirePermission/);
    expect(permissionService.can).not.toHaveBeenCalled();
  });

  it("rejects when SessionGuard hasn't run (no request.authUser)", async () => {
    const required: RequiredPermission = { moduleKey: "business_knowledge", action: "view" };
    const reflector = { get: vi.fn().mockReturnValue(required) };
    const permissionService = { can: vi.fn() };
    const guard = new PermissionGuard(
      reflector as unknown as Reflector,
      permissionService as unknown as PermissionService,
    );

    await expect(guard.canActivate(contextWithAuthUser(undefined))).rejects.toThrow(
      /Authentication required/,
    );
    expect(permissionService.can).not.toHaveBeenCalled();
  });

  it("denies with a 403 when PermissionService.can() returns false", async () => {
    const required: RequiredPermission = { moduleKey: "users_roles", action: "edit" };
    const reflector = { get: vi.fn().mockReturnValue(required) };
    const permissionService = { can: vi.fn().mockResolvedValue(false) };
    const guard = new PermissionGuard(
      reflector as unknown as Reflector,
      permissionService as unknown as PermissionService,
    );

    await expect(
      guard.canActivate(contextWithAuthUser({ id: "user-1", sessionId: "s1" })),
    ).rejects.toThrow(/Missing permission: users_roles:edit/);
  });

  it("allows through and checks the correct user/module/action when granted", async () => {
    const required: RequiredPermission = { moduleKey: "business_knowledge", action: "view" };
    const reflector = { get: vi.fn().mockReturnValue(required) };
    const permissionService = { can: vi.fn().mockResolvedValue(true) };
    const guard = new PermissionGuard(
      reflector as unknown as Reflector,
      permissionService as unknown as PermissionService,
    );

    const result = await guard.canActivate(contextWithAuthUser({ id: "user-1", sessionId: "s1" }));

    expect(result).toBe(true);
    expect(permissionService.can).toHaveBeenCalledWith("user-1", "business_knowledge", "view");
  });
});
