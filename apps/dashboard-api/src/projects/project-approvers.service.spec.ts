import type { RoleEntity, RoleRepository, UserRoleRepository } from "@webdesk/database";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleAssignmentService } from "../authz/role-assignment.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import type { UsersService } from "../users/users.service.js";
import { ProjectApproversService } from "./project-approvers.service.js";

describe("ProjectApproversService", () => {
  let roles: { findByKey: ReturnType<typeof vi.fn> };
  let userRoles: { findUserIdsForRoleInProject: ReturnType<typeof vi.fn> };
  let roleAssignment: { assignRole: ReturnType<typeof vi.fn> };
  let authorization: {
    evaluate: ReturnType<typeof vi.fn>;
    recordAccessDenied: ReturnType<typeof vi.fn>;
  };
  let usersService: { findById: ReturnType<typeof vi.fn> };
  let service: ProjectApproversService;

  beforeEach(() => {
    roles = { findByKey: vi.fn() };
    userRoles = { findUserIdsForRoleInProject: vi.fn() };
    roleAssignment = { assignRole: vi.fn() };
    authorization = {
      evaluate: vi.fn().mockResolvedValue({ allowed: true, reasonCode: null }),
      recordAccessDenied: vi.fn(),
    };
    usersService = { findById: vi.fn() };
    service = new ProjectApproversService(
      roles as unknown as RoleRepository,
      userRoles as unknown as UserRoleRepository,
      roleAssignment as unknown as RoleAssignmentService,
      authorization as unknown as AuthorizationService,
      usersService as unknown as UsersService,
    );
  });

  it("assigns the owner_growth_approver role scoped to the project (D4)", async () => {
    roles.findByKey.mockResolvedValue({
      id: "role-owner-growth",
      key: "owner_growth_approver",
    } as RoleEntity);

    await service.assign("project-1", "user-1", "actor-1");

    expect(authorization.evaluate).toHaveBeenCalledWith(
      "actor-1",
      "users_roles",
      "edit",
      "project-1",
    );
    expect(roles.findByKey).toHaveBeenCalledWith("owner_growth_approver");
    expect(roleAssignment.assignRole).toHaveBeenCalledWith(
      "user-1",
      "role-owner-growth",
      "actor-1",
      expect.any(Date),
      "project-1",
    );
  });

  it("throws if owner_growth_approver isn't seeded", async () => {
    roles.findByKey.mockResolvedValue(null);
    await expect(service.assign("project-1", "user-1", "actor-1")).rejects.toThrow(
      NotFoundException,
    );
  });

  it("rejects an actor who lacks users_roles:edit, without ever looking up or assigning the role (security-review finding)", async () => {
    authorization.evaluate.mockResolvedValue({ allowed: false, reasonCode: "no_grant" });

    await expect(service.assign("project-1", "user-1", "actor-1")).rejects.toThrow(
      ForbiddenException,
    );
    expect(authorization.recordAccessDenied).toHaveBeenCalledWith(
      "actor-1",
      "users_roles",
      "edit",
      "no_grant",
    );
    expect(roles.findByKey).not.toHaveBeenCalled();
    expect(roleAssignment.assignRole).not.toHaveBeenCalled();
  });

  describe("list", () => {
    it("resolves the project-scoped approver role's user ids to display summaries", async () => {
      roles.findByKey.mockResolvedValue({
        id: "role-owner-growth",
        key: "owner_growth_approver",
      } as RoleEntity);
      userRoles.findUserIdsForRoleInProject.mockResolvedValue(["user-1", "user-2"]);
      usersService.findById.mockImplementation((id: string) =>
        Promise.resolve({ id, displayName: `User ${id}`, email: `${id}@example.com` }),
      );

      const result = await service.list("project-1");

      expect(userRoles.findUserIdsForRoleInProject).toHaveBeenCalledWith(
        "role-owner-growth",
        "project-1",
      );
      expect(result).toEqual([
        { id: "user-1", displayName: "User user-1", email: "user-1@example.com" },
        { id: "user-2", displayName: "User user-2", email: "user-2@example.com" },
      ]);
    });

    it("silently drops a user id that no longer resolves (e.g. since disabled)", async () => {
      roles.findByKey.mockResolvedValue({
        id: "role-owner-growth",
        key: "owner_growth_approver",
      } as RoleEntity);
      userRoles.findUserIdsForRoleInProject.mockResolvedValue(["user-1", "user-stale"]);
      usersService.findById.mockImplementation((id: string) =>
        id === "user-stale"
          ? Promise.reject(new NotFoundException())
          : Promise.resolve({ id, displayName: "User One", email: "user-1@example.com" }),
      );

      const result = await service.list("project-1");

      expect(result).toEqual([
        { id: "user-1", displayName: "User One", email: "user-1@example.com" },
      ]);
    });

    it("throws if owner_growth_approver isn't seeded", async () => {
      roles.findByKey.mockResolvedValue(null);
      await expect(service.list("project-1")).rejects.toThrow(NotFoundException);
      expect(userRoles.findUserIdsForRoleInProject).not.toHaveBeenCalled();
    });
  });
});
