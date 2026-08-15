import type { RoleEntity, RoleRepository } from "@webdesk/database";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleAssignmentService } from "../authz/role-assignment.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import { ProjectApproversService } from "./project-approvers.service.js";

describe("ProjectApproversService", () => {
  let roles: { findByKey: ReturnType<typeof vi.fn> };
  let roleAssignment: { assignRole: ReturnType<typeof vi.fn> };
  let authorization: {
    evaluate: ReturnType<typeof vi.fn>;
    recordAccessDenied: ReturnType<typeof vi.fn>;
  };
  let service: ProjectApproversService;

  beforeEach(() => {
    roles = { findByKey: vi.fn() };
    roleAssignment = { assignRole: vi.fn() };
    authorization = {
      evaluate: vi.fn().mockResolvedValue({ allowed: true, reasonCode: null }),
      recordAccessDenied: vi.fn(),
    };
    service = new ProjectApproversService(
      roles as unknown as RoleRepository,
      roleAssignment as unknown as RoleAssignmentService,
      authorization as unknown as AuthorizationService,
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
});
