import type {
  ModuleRepository,
  RolePermissionRepository,
  UserRoleRepository,
} from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionService } from "./permission.service.js";

describe("PermissionService", () => {
  let modules: { findByKey: ReturnType<typeof vi.fn> };
  let rolePermissions: { hasGrant: ReturnType<typeof vi.fn> };
  let userRoles: { findRoleIdsForUser: ReturnType<typeof vi.fn> };
  let service: PermissionService;

  beforeEach(() => {
    modules = { findByKey: vi.fn() };
    rolePermissions = { hasGrant: vi.fn() };
    userRoles = { findRoleIdsForUser: vi.fn() };
    service = new PermissionService(
      modules as unknown as ModuleRepository,
      rolePermissions as unknown as RolePermissionRepository,
      userRoles as unknown as UserRoleRepository,
    );
  });

  it("denies when the module key is unknown", async () => {
    modules.findByKey.mockResolvedValue(null);
    expect(await service.can("user-1", "no-such-module", "view")).toBe(false);
    expect(userRoles.findRoleIdsForUser).not.toHaveBeenCalled();
  });

  it("denies when the user holds no roles", async () => {
    modules.findByKey.mockResolvedValue({ id: "module-1" });
    userRoles.findRoleIdsForUser.mockResolvedValue([]);
    expect(await service.can("user-1", "business_knowledge", "view")).toBe(false);
    expect(rolePermissions.hasGrant).not.toHaveBeenCalled();
  });

  it("denies when none of the user's roles have the grant", async () => {
    modules.findByKey.mockResolvedValue({ id: "module-1" });
    userRoles.findRoleIdsForUser.mockResolvedValue(["role-1"]);
    rolePermissions.hasGrant.mockResolvedValue(false);
    expect(await service.can("user-1", "business_knowledge", "approve")).toBe(false);
  });

  it("allows when a held role has the grant", async () => {
    modules.findByKey.mockResolvedValue({ id: "module-1" });
    userRoles.findRoleIdsForUser.mockResolvedValue(["role-1"]);
    rolePermissions.hasGrant.mockResolvedValue(true);
    expect(await service.can("user-1", "business_knowledge", "view")).toBe(true);
  });

  it("passes every held role id to the grant check, not just the first", async () => {
    modules.findByKey.mockResolvedValue({ id: "module-1" });
    userRoles.findRoleIdsForUser.mockResolvedValue(["role-1", "role-2"]);
    rolePermissions.hasGrant.mockResolvedValue(true);
    await service.can("user-1", "business_knowledge", "view");
    expect(rolePermissions.hasGrant).toHaveBeenCalledWith(["role-1", "role-2"], "module-1", "view");
  });
});
