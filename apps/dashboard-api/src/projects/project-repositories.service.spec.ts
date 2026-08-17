import type { ProjectRepositoryEntity, ProjectRepositoryRepository } from "@webdesk/database";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectRepositoriesService } from "./project-repositories.service.js";

const NOW = new Date("2026-08-17T00:00:00.000Z");

function repositoryLink(overrides: Partial<ProjectRepositoryEntity> = {}): ProjectRepositoryEntity {
  return {
    id: "repo-link-1",
    projectId: "project-1",
    repoOwner: "WDS-Internal-DeveloperTeam",
    repoName: "webdesk-growth-dashboard",
    defaultBranch: "main",
    notes: null,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ProjectRepositoriesService", () => {
  let repositories: {
    create: ReturnType<typeof vi.fn>;
    listByProject: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let service: ProjectRepositoriesService;

  beforeEach(() => {
    repositories = { create: vi.fn(), listByProject: vi.fn(), update: vi.fn(), remove: vi.fn() };
    service = new ProjectRepositoriesService(
      repositories as unknown as ProjectRepositoryRepository,
    );
  });

  describe("create", () => {
    it("links a repository to the project", async () => {
      repositories.create.mockResolvedValue(repositoryLink());
      const result = await service.create(
        "project-1",
        { repoOwner: "WDS-Internal-DeveloperTeam", repoName: "webdesk-growth-dashboard" },
        "actor-1",
      );
      expect(result.repoName).toBe("webdesk-growth-dashboard");
      expect(repositories.create).toHaveBeenCalledWith({
        projectId: "project-1",
        repoOwner: "WDS-Internal-DeveloperTeam",
        repoName: "webdesk-growth-dashboard",
        createdBy: "actor-1",
      });
    });
  });

  describe("listByProject", () => {
    it("delegates to the repository", async () => {
      repositories.listByProject.mockResolvedValue([repositoryLink()]);
      const result = await service.listByProject("project-1");
      expect(result).toEqual([repositoryLink()]);
    });
  });

  describe("update", () => {
    it("updates a linked repository's metadata", async () => {
      repositories.update.mockResolvedValue(repositoryLink({ defaultBranch: "develop" }));
      const result = await service.update(
        "repo-link-1",
        "project-1",
        { defaultBranch: "develop" },
        "actor-1",
      );
      expect(result.defaultBranch).toBe("develop");
      expect(repositories.update).toHaveBeenCalledWith("repo-link-1", "project-1", {
        defaultBranch: "develop",
        updatedBy: "actor-1",
      });
    });

    it("throws NotFoundException when nothing was updated", async () => {
      repositories.update.mockResolvedValue(null);
      await expect(
        service.update("repo-link-1", "project-1", { defaultBranch: "develop" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("unlinks a repository", async () => {
      repositories.remove.mockResolvedValue(true);
      await service.remove("repo-link-1", "project-1");
      expect(repositories.remove).toHaveBeenCalledWith("repo-link-1", "project-1");
    });

    it("throws NotFoundException when nothing was removed", async () => {
      repositories.remove.mockResolvedValue(false);
      await expect(service.remove("repo-link-1", "project-1")).rejects.toThrow(NotFoundException);
    });
  });
});
