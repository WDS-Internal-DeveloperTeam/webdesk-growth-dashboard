import type { ProjectEnvironmentEntity, ProjectEnvironmentRepository } from "@webdesk/database";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectEnvironmentsService } from "./project-environments.service.js";

const NOW = new Date("2026-08-17T00:00:00.000Z");

function environment(overrides: Partial<ProjectEnvironmentEntity> = {}): ProjectEnvironmentEntity {
  return {
    id: "env-1",
    projectId: "project-1",
    name: "Staging",
    url: "https://staging.example.com",
    notes: null,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ProjectEnvironmentsService", () => {
  let environments: {
    create: ReturnType<typeof vi.fn>;
    listByProject: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let service: ProjectEnvironmentsService;

  beforeEach(() => {
    environments = {
      create: vi.fn(),
      listByProject: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    service = new ProjectEnvironmentsService(
      environments as unknown as ProjectEnvironmentRepository,
    );
  });

  describe("create", () => {
    it("creates an environment scoped to the project", async () => {
      environments.create.mockResolvedValue(environment());
      const result = await service.create(
        "project-1",
        { name: "Staging", url: "https://staging.example.com" },
        "actor-1",
      );
      expect(result.name).toBe("Staging");
      expect(environments.create).toHaveBeenCalledWith({
        projectId: "project-1",
        name: "Staging",
        url: "https://staging.example.com",
        createdBy: "actor-1",
      });
    });
  });

  describe("listByProject", () => {
    it("delegates to the repository", async () => {
      environments.listByProject.mockResolvedValue([environment()]);
      const result = await service.listByProject("project-1");
      expect(result).toEqual([environment()]);
    });
  });

  describe("update", () => {
    it("updates an environment", async () => {
      environments.update.mockResolvedValue(environment({ name: "Prod" }));
      const result = await service.update("env-1", "project-1", { name: "Prod" }, "actor-1");
      expect(result.name).toBe("Prod");
      expect(environments.update).toHaveBeenCalledWith("env-1", "project-1", {
        name: "Prod",
        updatedBy: "actor-1",
      });
    });

    it("throws NotFoundException when nothing was updated (IDOR guard / already gone)", async () => {
      environments.update.mockResolvedValue(null);
      await expect(
        service.update("env-1", "project-1", { name: "Prod" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("removes an environment", async () => {
      environments.remove.mockResolvedValue(true);
      await service.remove("env-1", "project-1");
      expect(environments.remove).toHaveBeenCalledWith("env-1", "project-1");
    });

    it("throws NotFoundException when nothing was removed", async () => {
      environments.remove.mockResolvedValue(false);
      await expect(service.remove("env-1", "project-1")).rejects.toThrow(NotFoundException);
    });
  });
});
