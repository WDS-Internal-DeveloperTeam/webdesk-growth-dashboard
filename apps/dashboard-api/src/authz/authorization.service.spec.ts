import type {
  AuthEventRepository,
  ModuleRegistryRepository,
  ModuleRepository,
  RolePermissionRepository,
  UserRepository,
  UserRoleRepository,
} from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationService } from "./authorization.service.js";

const ACTIVE_USER = { id: "user-1", accountStatus: "active" };
const DISABLED_USER = { id: "user-1", accountStatus: "disabled" };

describe("AuthorizationService", () => {
  let modules: { findByKey: ReturnType<typeof vi.fn>; listAll: ReturnType<typeof vi.fn> };
  let rolePermissions: {
    hasGrant: ReturnType<typeof vi.fn>;
    listGrantsForRoles: ReturnType<typeof vi.fn>;
  };
  let userRoles: { findRoleIdsForUser: ReturnType<typeof vi.fn> };
  let users: { findById: ReturnType<typeof vi.fn> };
  let events: { record: ReturnType<typeof vi.fn> };
  let moduleRegistry: { findByKey: ReturnType<typeof vi.fn> };
  let service: AuthorizationService;

  beforeEach(() => {
    modules = { findByKey: vi.fn(), listAll: vi.fn() };
    rolePermissions = { hasGrant: vi.fn(), listGrantsForRoles: vi.fn() };
    userRoles = { findRoleIdsForUser: vi.fn() };
    users = { findById: vi.fn() };
    events = { record: vi.fn() };
    moduleRegistry = { findByKey: vi.fn() };
    service = new AuthorizationService(
      modules as unknown as ModuleRepository,
      rolePermissions as unknown as RolePermissionRepository,
      userRoles as unknown as UserRoleRepository,
      users as unknown as UserRepository,
      events as unknown as AuthEventRepository,
      moduleRegistry as unknown as ModuleRegistryRepository,
    );
  });

  describe("evaluate", () => {
    it("denies with user_not_found when no such user exists, before touching modules/roles", async () => {
      users.findById.mockResolvedValue(null);
      const result = await service.evaluate("no-such-user", "business_knowledge", "view");
      expect(result).toEqual({ allowed: false, reasonCode: "user_not_found" });
      expect(modules.findByKey).not.toHaveBeenCalled();
    });

    it("denies with user_disabled for a disabled account, before touching modules/roles", async () => {
      users.findById.mockResolvedValue(DISABLED_USER);
      const result = await service.evaluate("user-1", "business_knowledge", "view");
      expect(result).toEqual({ allowed: false, reasonCode: "user_disabled" });
      expect(modules.findByKey).not.toHaveBeenCalled();
    });

    it("denies with unknown_module when the module key is unknown", async () => {
      users.findById.mockResolvedValue(ACTIVE_USER);
      modules.findByKey.mockResolvedValue(null);
      const result = await service.evaluate("user-1", "no-such-module", "view");
      expect(result).toEqual({ allowed: false, reasonCode: "unknown_module" });
      expect(userRoles.findRoleIdsForUser).not.toHaveBeenCalled();
    });

    it("denies with no_roles when the user holds no roles", async () => {
      users.findById.mockResolvedValue(ACTIVE_USER);
      modules.findByKey.mockResolvedValue({ id: "module-1" });
      userRoles.findRoleIdsForUser.mockResolvedValue([]);
      const result = await service.evaluate("user-1", "business_knowledge", "view");
      expect(result).toEqual({ allowed: false, reasonCode: "no_roles" });
      expect(rolePermissions.hasGrant).not.toHaveBeenCalled();
    });

    it("denies with no_grant when none of the user's roles have the grant", async () => {
      users.findById.mockResolvedValue(ACTIVE_USER);
      modules.findByKey.mockResolvedValue({ id: "module-1" });
      userRoles.findRoleIdsForUser.mockResolvedValue(["role-1"]);
      rolePermissions.hasGrant.mockResolvedValue(false);
      const result = await service.evaluate("user-1", "business_knowledge", "approve");
      expect(result).toEqual({ allowed: false, reasonCode: "no_grant" });
    });

    it("allows with a null reasonCode when a held role has the grant", async () => {
      users.findById.mockResolvedValue(ACTIVE_USER);
      modules.findByKey.mockResolvedValue({ id: "module-1" });
      userRoles.findRoleIdsForUser.mockResolvedValue(["role-1"]);
      rolePermissions.hasGrant.mockResolvedValue(true);
      const result = await service.evaluate("user-1", "business_knowledge", "view");
      expect(result).toEqual({ allowed: true, reasonCode: null });
    });

    it("passes projectId through to both role and grant resolution", async () => {
      users.findById.mockResolvedValue(ACTIVE_USER);
      modules.findByKey.mockResolvedValue({ id: "module-1" });
      userRoles.findRoleIdsForUser.mockResolvedValue(["role-1"]);
      rolePermissions.hasGrant.mockResolvedValue(true);

      await service.evaluate("user-1", "business_knowledge", "view", "project-a");

      expect(userRoles.findRoleIdsForUser).toHaveBeenCalledWith("user-1", "project-a");
      expect(rolePermissions.hasGrant).toHaveBeenCalledWith(
        ["role-1"],
        "module-1",
        "view",
        "project-a",
      );
    });
  });

  describe("can", () => {
    it("collapses evaluate()'s result to a boolean", async () => {
      users.findById.mockResolvedValue(null);
      expect(await service.can("no-such-user", "business_knowledge", "view")).toBe(false);
    });
  });

  describe("canViewConfidential / canEditConfidential", () => {
    it("checks the view_confidential/edit_confidential actions specifically", async () => {
      users.findById.mockResolvedValue(ACTIVE_USER);
      modules.findByKey.mockResolvedValue({ id: "module-1" });
      userRoles.findRoleIdsForUser.mockResolvedValue(["role-1"]);
      rolePermissions.hasGrant.mockResolvedValue(true);

      await service.canViewConfidential("user-1", "case_studies");
      expect(rolePermissions.hasGrant).toHaveBeenCalledWith(
        ["role-1"],
        "module-1",
        "view_confidential",
        undefined,
      );

      await service.canEditConfidential("user-1", "case_studies");
      expect(rolePermissions.hasGrant).toHaveBeenCalledWith(
        ["role-1"],
        "module-1",
        "edit_confidential",
        undefined,
      );
    });
  });

  describe("getEffectiveCapabilities", () => {
    it("returns {} for a user that doesn't exist", async () => {
      users.findById.mockResolvedValue(null);
      expect(await service.getEffectiveCapabilities("no-such-user")).toEqual({});
      expect(userRoles.findRoleIdsForUser).not.toHaveBeenCalled();
    });

    it("returns {} for a disabled user", async () => {
      users.findById.mockResolvedValue(DISABLED_USER);
      expect(await service.getEffectiveCapabilities("user-1")).toEqual({});
    });

    it("returns {} when the user holds no roles, without querying grants", async () => {
      users.findById.mockResolvedValue(ACTIVE_USER);
      userRoles.findRoleIdsForUser.mockResolvedValue([]);
      expect(await service.getEffectiveCapabilities("user-1")).toEqual({});
      expect(rolePermissions.listGrantsForRoles).not.toHaveBeenCalled();
    });

    it("groups grants by module key, deduplicating repeated actions across roles", async () => {
      users.findById.mockResolvedValue(ACTIVE_USER);
      userRoles.findRoleIdsForUser.mockResolvedValue(["role-1", "role-2"]);
      rolePermissions.listGrantsForRoles.mockResolvedValue([
        { moduleId: "module-1", action: "view" },
        { moduleId: "module-1", action: "edit" },
        { moduleId: "module-1", action: "view" }, // held by both roles — must not appear twice
        { moduleId: "module-2", action: "view" },
      ]);
      modules.listAll.mockResolvedValue([
        { id: "module-1", key: "business_knowledge", name: "Business Knowledge" },
        { id: "module-2", key: "page_content", name: "Page content" },
      ]);

      const capabilities = await service.getEffectiveCapabilities("user-1");

      expect(capabilities).toEqual({
        business_knowledge: ["view", "edit"],
        page_content: ["view"],
      });
    });

    it("uses exactly one query for roles and one for grants — never one per module", async () => {
      users.findById.mockResolvedValue(ACTIVE_USER);
      userRoles.findRoleIdsForUser.mockResolvedValue(["role-1"]);
      rolePermissions.listGrantsForRoles.mockResolvedValue([]);
      modules.listAll.mockResolvedValue([]);

      await service.getEffectiveCapabilities("user-1");

      expect(userRoles.findRoleIdsForUser).toHaveBeenCalledTimes(1);
      expect(rolePermissions.listGrantsForRoles).toHaveBeenCalledTimes(1);
      expect(modules.findByKey).not.toHaveBeenCalled();
    });
  });

  describe("recordAccessDenied", () => {
    it("records a privileged_access_denied event with the module/action/reason", async () => {
      await service.recordAccessDenied("user-1", "users_roles", "edit", "no_grant");
      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "privileged_access_denied",
          userId: "user-1",
          success: false,
          reason: expect.stringContaining("no_grant"),
        }),
      );
    });
  });

  describe("assertAllowed", () => {
    it("resolves without recording anything when the action is granted", async () => {
      users.findById.mockResolvedValue(ACTIVE_USER);
      modules.findByKey.mockResolvedValue({ id: "module-1" });
      userRoles.findRoleIdsForUser.mockResolvedValue(["role-1"]);
      rolePermissions.hasGrant.mockResolvedValue(true);

      await expect(
        service.assertAllowed("user-1", "service_persona_proof", "approve"),
      ).resolves.toBeUndefined();
      expect(events.record).not.toHaveBeenCalled();
    });

    it("records a denial and throws ForbiddenException when the action is not granted", async () => {
      users.findById.mockResolvedValue(ACTIVE_USER);
      modules.findByKey.mockResolvedValue({ id: "module-1" });
      userRoles.findRoleIdsForUser.mockResolvedValue(["role-1"]);
      rolePermissions.hasGrant.mockResolvedValue(false);

      await expect(
        service.assertAllowed("user-1", "service_persona_proof", "approve"),
      ).rejects.toThrow("Missing permission: service_persona_proof:approve");
      expect(events.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "privileged_access_denied",
          userId: "user-1",
          success: false,
          reason: expect.stringContaining("no_grant"),
        }),
      );
    });
  });

  describe("isValidModuleKey", () => {
    it("returns true when the module registry has a matching key", async () => {
      moduleRegistry.findByKey.mockResolvedValue({ key: "review_and_approval_center" });
      expect(await service.isValidModuleKey("review_and_approval_center")).toBe(true);
      expect(moduleRegistry.findByKey).toHaveBeenCalledWith("review_and_approval_center");
    });

    it("returns false when no module registry entry matches the key", async () => {
      moduleRegistry.findByKey.mockResolvedValue(null);
      expect(await service.isValidModuleKey("no-such-module")).toBe(false);
    });
  });
});
