import type { ProjectUserEntity, ProjectUserRepository } from "@webdesk/database";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectTeamService } from "./project-team.service.js";

const NOW = new Date("2026-08-17T00:00:00.000Z");

function teamEntry(overrides: Partial<ProjectUserEntity> = {}): ProjectUserEntity {
  return {
    id: "entry-1",
    projectId: "project-1",
    userId: "user-1",
    addedAt: NOW.toISOString(),
    addedBy: "actor-1",
    ...overrides,
  };
}

describe("ProjectTeamService", () => {
  let team: {
    add: ReturnType<typeof vi.fn>;
    findByProjectAndUser: ReturnType<typeof vi.fn>;
    listByProject: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let service: ProjectTeamService;

  beforeEach(() => {
    team = {
      add: vi.fn(),
      findByProjectAndUser: vi.fn(),
      listByProject: vi.fn(),
      remove: vi.fn(),
    };
    service = new ProjectTeamService(team as unknown as ProjectUserRepository);
  });

  describe("add", () => {
    it("adds a user to the project team roster", async () => {
      team.findByProjectAndUser.mockResolvedValue(null);
      team.add.mockResolvedValue(teamEntry());

      const result = await service.add("project-1", "user-1", "actor-1");

      expect(result.userId).toBe("user-1");
      expect(team.add).toHaveBeenCalledWith({
        projectId: "project-1",
        userId: "user-1",
        addedBy: "actor-1",
      });
    });

    it("rejects a user already on the team", async () => {
      team.findByProjectAndUser.mockResolvedValue(teamEntry());
      await expect(service.add("project-1", "user-1", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(team.add).not.toHaveBeenCalled();
    });
  });

  describe("listByProject", () => {
    it("delegates to the repository", async () => {
      team.listByProject.mockResolvedValue([teamEntry()]);
      const result = await service.listByProject("project-1");
      expect(result).toEqual([teamEntry()]);
      expect(team.listByProject).toHaveBeenCalledWith("project-1");
    });
  });

  describe("remove", () => {
    it("removes a team entry", async () => {
      team.remove.mockResolvedValue(true);
      await service.remove("entry-1", "project-1");
      expect(team.remove).toHaveBeenCalledWith("entry-1", "project-1");
    });

    it("throws NotFoundException when nothing was removed (IDOR guard / already gone)", async () => {
      team.remove.mockResolvedValue(false);
      await expect(service.remove("entry-1", "project-1")).rejects.toThrow(NotFoundException);
    });
  });
});
