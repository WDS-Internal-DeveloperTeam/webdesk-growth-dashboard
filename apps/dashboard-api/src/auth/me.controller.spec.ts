import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UserRepository } from "@webdesk/database";
import type { AuthenticatedRequest } from "./session/session.guard.js";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { MeController } from "./me.controller.js";

function fakeRequest(userId: string): AuthenticatedRequest & RequestWithCorrelationId {
  return {
    authUser: { id: userId, sessionId: "session-1" },
    correlationId: "corr-1",
  } as AuthenticatedRequest & RequestWithCorrelationId;
}

describe("MeController", () => {
  let users: { findById: ReturnType<typeof vi.fn> };
  let controller: MeController;

  beforeEach(() => {
    users = { findById: vi.fn() };
    controller = new MeController(users as unknown as UserRepository);
  });

  it("returns the caller's own basic identity", async () => {
    users.findById.mockResolvedValue({
      id: "user-1",
      email: "jane@webdesksolution.com",
      displayName: "Jane Doe",
      accountStatus: "active",
      lastLoginAt: null,
      createdAt: "x",
      updatedAt: "x",
    });

    const result = await controller.getMe(fakeRequest("user-1"));

    expect(result).toEqual({
      success: true,
      data: { id: "user-1", email: "jane@webdesksolution.com", displayName: "Jane Doe" },
      correlationId: "corr-1",
    });
    expect(users.findById).toHaveBeenCalledWith("user-1");
  });

  it("fails safely (no stack trace) when the session's user no longer exists", async () => {
    users.findById.mockResolvedValue(null);
    await expect(controller.getMe(fakeRequest("gone"))).rejects.toThrow(
      "Unable to load your profile",
    );
  });
});
