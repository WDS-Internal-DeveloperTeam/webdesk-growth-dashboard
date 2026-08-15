import type { RoleEntity, RoleRepository } from "@webdesk/database";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RoleAssignmentService } from "../authz/role-assignment.service.js";
import { ProjectApproversService } from "./project-approvers.service.js";

describe("ProjectApproversService", () => {
  let roles: { findByKey: ReturnType<typeof vi.fn> };
  let roleAssignment: { assignRole: ReturnType<typeof vi.fn> };
  let service: ProjectApproversService;

  beforeEach(() => {
    roles = { findByKey: vi.fn() };
    roleAssignment = { assignRole: vi.fn() };
    service = new ProjectApproversService(
      roles as unknown as RoleRepository,
      roleAssignment as unknown as RoleAssignmentService,
    );
  });

  it("assigns the owner_growth_approver role scoped to the project (D4)", async () => {
    roles.findByKey.mockResolvedValue({
      id: "role-owner-growth",
      key: "owner_growth_approver",
    } as RoleEntity);

    await service.assign("project-1", "user-1", "actor-1");

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
});
