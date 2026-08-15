import type {
  ProjectEntity,
  ProjectRepository,
  RoadmapItemEntity,
  RoadmapItemRepository,
} from "@webdesk/database";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import { RoadmapItemsService } from "./roadmap-items.service.js";

const NOW = new Date("2026-08-15T00:00:00.000Z");

function project(overrides: Partial<ProjectEntity> = {}): ProjectEntity {
  return {
    id: "project-1",
    publicId: "acme-website",
    name: "Acme Website",
    description: null,
    status: "active",
    activePhaseId: null,
    ownerUserId: null,
    confidentiality: "internal",
    retentionCategory: null,
    createdBy: null,
    updatedBy: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function roadmapItem(overrides: Partial<RoadmapItemEntity> = {}): RoadmapItemEntity {
  return {
    id: "phase-1",
    projectId: "project-1",
    name: "Discovery",
    sequence: 0,
    status: "not_started",
    createdBy: null,
    updatedBy: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("RoadmapItemsService", () => {
  let roadmapItems: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    listByProject: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let projects: { findById: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let service: RoadmapItemsService;

  beforeEach(() => {
    roadmapItems = {
      create: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
      listByProject: vi.fn(),
      remove: vi.fn(),
    };
    projects = { findById: vi.fn() };
    auditService = { record: vi.fn() };
    service = new RoadmapItemsService(
      roadmapItems as unknown as RoadmapItemRepository,
      projects as unknown as ProjectRepository,
      auditService as unknown as AuditService,
    );
  });

  describe("remove", () => {
    it("rejects removing the project's current active phase (destructive-deletion guard)", async () => {
      roadmapItems.findById.mockResolvedValue(roadmapItem({ id: "phase-1" }));
      projects.findById.mockResolvedValue(project({ activePhaseId: "phase-1" }));

      await expect(service.remove("phase-1", "actor-1")).rejects.toThrow(BadRequestException);
      expect(roadmapItems.remove).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it("allows removing a roadmap item that is not the active phase", async () => {
      roadmapItems.findById.mockResolvedValue(roadmapItem({ id: "phase-2" }));
      projects.findById.mockResolvedValue(project({ activePhaseId: "phase-1" }));
      roadmapItems.remove.mockResolvedValue(true);

      await service.remove("phase-2", "actor-1");

      expect(roadmapItems.remove).toHaveBeenCalledWith("phase-2");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "data_change",
          action: "delete",
          entityId: "phase-2",
        }),
      );
    });

    it("allows removing a roadmap item when the project has no active phase at all", async () => {
      roadmapItems.findById.mockResolvedValue(roadmapItem({ id: "phase-1" }));
      projects.findById.mockResolvedValue(project({ activePhaseId: null }));
      roadmapItems.remove.mockResolvedValue(true);

      await service.remove("phase-1", "actor-1");

      expect(roadmapItems.remove).toHaveBeenCalledWith("phase-1");
    });

    it("throws NotFoundException for a missing roadmap item", async () => {
      roadmapItems.findById.mockResolvedValue(null);
      await expect(service.remove("missing", "actor-1")).rejects.toThrow(NotFoundException);
    });
  });
});
