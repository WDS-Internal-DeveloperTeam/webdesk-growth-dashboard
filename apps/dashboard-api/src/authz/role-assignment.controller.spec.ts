import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { RoleAssignmentController } from "./role-assignment.controller.js";
import type { RoleAssignmentService } from "./role-assignment.service.js";

const ROLE = { id: "role-1", key: "owner", name: "Owner" };

function requestWith(
  overrides: Partial<AuthenticatedRequest> = {},
): AuthenticatedRequest & { correlationId?: string } {
  return {
    authUser: { id: "actor-1", sessionId: "session-1" },
    correlationId: "corr-1",
    ...overrides,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- minimal fake AuthenticatedRequest + correlationId.
  } as any;
}

describe("RoleAssignmentController", () => {
  let roleAssignment: {
    listRoles: ReturnType<typeof vi.fn>;
    listRolesForUser: ReturnType<typeof vi.fn>;
    assignRole: ReturnType<typeof vi.fn>;
    revokeRole: ReturnType<typeof vi.fn>;
  };
  let controller: RoleAssignmentController;

  beforeEach(() => {
    roleAssignment = {
      listRoles: vi.fn(),
      listRolesForUser: vi.fn(),
      assignRole: vi.fn(),
      revokeRole: vi.fn(),
    };
    controller = new RoleAssignmentController(roleAssignment as unknown as RoleAssignmentService);
  });

  it("listRoles() wraps the service's roles in the success envelope, summarized to id/key/name", async () => {
    roleAssignment.listRoles.mockResolvedValue([{ ...ROLE, extraInternalField: "ignored" }]);

    const result = await controller.listRoles(requestWith());

    expect(result).toEqual({
      success: true,
      data: [ROLE],
      correlationId: "corr-1",
    });
  });

  it("listRoles() falls back to 'unknown' correlationId when the request has none", async () => {
    roleAssignment.listRoles.mockResolvedValue([]);
    const result = await controller.listRoles(requestWith({ correlationId: undefined } as never));
    expect(result.correlationId).toBe("unknown");
  });

  it("listUserRoles() delegates to the service with the path userId", async () => {
    roleAssignment.listRolesForUser.mockResolvedValue([ROLE]);

    const result = await controller.listUserRoles("target-user", requestWith());

    expect(roleAssignment.listRolesForUser).toHaveBeenCalledWith("target-user");
    expect(result.data).toEqual([ROLE]);
  });

  it("assignRole() calls the service with target user, role, and the acting user's id from the session", async () => {
    roleAssignment.assignRole.mockResolvedValue(undefined);

    const result = await controller.assignRole("target-user", { roleId: "role-1" }, requestWith());

    expect(roleAssignment.assignRole).toHaveBeenCalledWith("target-user", "role-1", "actor-1");
    expect(result).toEqual({ success: true, data: { assigned: true }, correlationId: "corr-1" });
  });

  it("revokeRole() calls the service with target user, role, and the acting user's id from the session", async () => {
    roleAssignment.revokeRole.mockResolvedValue(true);

    const result = await controller.revokeRole("target-user", "role-1", undefined, requestWith());

    expect(roleAssignment.revokeRole).toHaveBeenCalledWith(
      "target-user",
      "role-1",
      "actor-1",
      undefined,
      null,
    );
    expect(result).toEqual({ success: true, data: { revoked: true }, correlationId: "corr-1" });
  });

  it("revokeRole() passes a given projectId through, and reports revoked:false when nothing was removed (security-review finding)", async () => {
    roleAssignment.revokeRole.mockResolvedValue(false);

    const result = await controller.revokeRole("target-user", "role-1", "project-1", requestWith());

    expect(roleAssignment.revokeRole).toHaveBeenCalledWith(
      "target-user",
      "role-1",
      "actor-1",
      undefined,
      "project-1",
    );
    expect(result).toEqual({ success: true, data: { revoked: false }, correlationId: "corr-1" });
  });
});
