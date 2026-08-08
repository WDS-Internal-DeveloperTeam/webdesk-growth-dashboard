import type { AuthorizationActionRepository } from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SeparationOfDutiesService } from "./separation-of-duties.service.js";

describe("SeparationOfDutiesService", () => {
  let authorizationActions: {
    findActorsForResource: ReturnType<typeof vi.fn>;
    record: ReturnType<typeof vi.fn>;
  };
  let service: SeparationOfDutiesService;

  beforeEach(() => {
    authorizationActions = { findActorsForResource: vi.fn(), record: vi.fn() };
    service = new SeparationOfDutiesService(
      authorizationActions as unknown as AuthorizationActionRepository,
    );
  });

  describe("assertDistinctActors", () => {
    it("throws when the approver and actor are the same", () => {
      expect(() => service.assertDistinctActors("user-1", "user-1", "submitter")).toThrow(
        /Separation of duties/,
      );
    });

    it("includes the caller-supplied context in the error message", () => {
      expect(() => service.assertDistinctActors("user-1", "user-1", "release implementer")).toThrow(
        /release implementer/,
      );
    });

    it("does not throw when the approver and actor are distinct", () => {
      expect(() => service.assertDistinctActors("user-1", "user-2", "submitter")).not.toThrow();
    });
  });

  describe("assertNoPriorConflictingAction", () => {
    it("throws when the actor already performed the conflicting action on this resource", async () => {
      authorizationActions.findActorsForResource.mockResolvedValue(["user-1", "user-2"]);

      await expect(
        service.assertNoPriorConflictingAction(
          "code_change",
          "pr-42",
          "implemented",
          "user-1",
          "code reviewer",
        ),
      ).rejects.toThrow(/Separation of duties/);
    });

    it("includes the action type, resource type, and context in the error message", async () => {
      authorizationActions.findActorsForResource.mockResolvedValue(["user-1"]);

      await expect(
        service.assertNoPriorConflictingAction(
          "code_change",
          "pr-42",
          "implemented",
          "user-1",
          "code reviewer",
        ),
      ).rejects.toThrow(/implemented.*code_change|code reviewer/);
    });

    it("does not throw when the actor never performed the conflicting action", async () => {
      authorizationActions.findActorsForResource.mockResolvedValue(["someone-else"]);

      await expect(
        service.assertNoPriorConflictingAction(
          "code_change",
          "pr-42",
          "implemented",
          "user-1",
          "code reviewer",
        ),
      ).resolves.not.toThrow();
    });

    it("does not throw when no one has performed the prior action at all", async () => {
      authorizationActions.findActorsForResource.mockResolvedValue([]);

      await expect(
        service.assertNoPriorConflictingAction(
          "code_change",
          "pr-42",
          "implemented",
          "user-1",
          "code reviewer",
        ),
      ).resolves.not.toThrow();
    });

    it("queries with the exact resource type, resource id, and prior action type given", async () => {
      authorizationActions.findActorsForResource.mockResolvedValue([]);

      await service.assertNoPriorConflictingAction(
        "release",
        "release-7",
        "executed_release",
        "user-1",
        "release approver",
      );

      expect(authorizationActions.findActorsForResource).toHaveBeenCalledWith(
        "release",
        "release-7",
        "executed_release",
      );
    });
  });

  describe("recordAction", () => {
    it("delegates to the repository with the given actor/action/resource", async () => {
      await service.recordAction("user-1", "implemented", "code_change", "pr-42");
      expect(authorizationActions.record).toHaveBeenCalledWith({
        actorId: "user-1",
        actionType: "implemented",
        resourceType: "code_change",
        resourceId: "pr-42",
      });
    });
  });
});
