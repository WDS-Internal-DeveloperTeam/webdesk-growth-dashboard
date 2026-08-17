import type { ProjectObjectiveEntity, ProjectObjectiveRepository } from "@webdesk/database";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectObjectivesService } from "./project-objectives.service.js";

const NOW = new Date("2026-08-17T00:00:00.000Z");

function objective(overrides: Partial<ProjectObjectiveEntity> = {}): ProjectObjectiveEntity {
  return {
    id: "objective-1",
    projectId: "project-1",
    description: "Grow organic traffic 20%",
    status: "open",
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ProjectObjectivesService", () => {
  let objectives: {
    create: ReturnType<typeof vi.fn>;
    listByProject: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let service: ProjectObjectivesService;

  beforeEach(() => {
    objectives = { create: vi.fn(), listByProject: vi.fn(), update: vi.fn(), remove: vi.fn() };
    service = new ProjectObjectivesService(objectives as unknown as ProjectObjectiveRepository);
  });

  describe("create", () => {
    it("creates an objective scoped to the project", async () => {
      objectives.create.mockResolvedValue(objective());
      const result = await service.create("project-1", "Grow organic traffic 20%", "actor-1");
      expect(result.description).toBe("Grow organic traffic 20%");
      expect(objectives.create).toHaveBeenCalledWith({
        projectId: "project-1",
        description: "Grow organic traffic 20%",
        createdBy: "actor-1",
      });
    });
  });

  describe("listByProject", () => {
    it("delegates to the repository", async () => {
      objectives.listByProject.mockResolvedValue([objective()]);
      const result = await service.listByProject("project-1");
      expect(result).toEqual([objective()]);
    });
  });

  describe("update", () => {
    it("updates an objective's status", async () => {
      objectives.update.mockResolvedValue(objective({ status: "complete" }));
      const result = await service.update(
        "objective-1",
        "project-1",
        { status: "complete" },
        "actor-1",
      );
      expect(result.status).toBe("complete");
      expect(objectives.update).toHaveBeenCalledWith("objective-1", "project-1", {
        status: "complete",
        updatedBy: "actor-1",
      });
    });

    it("throws NotFoundException when nothing was updated", async () => {
      objectives.update.mockResolvedValue(null);
      await expect(
        service.update("objective-1", "project-1", { status: "complete" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("removes an objective", async () => {
      objectives.remove.mockResolvedValue(true);
      await service.remove("objective-1", "project-1");
      expect(objectives.remove).toHaveBeenCalledWith("objective-1", "project-1");
    });

    it("throws NotFoundException when nothing was removed", async () => {
      objectives.remove.mockResolvedValue(false);
      await expect(service.remove("objective-1", "project-1")).rejects.toThrow(NotFoundException);
    });
  });
});
