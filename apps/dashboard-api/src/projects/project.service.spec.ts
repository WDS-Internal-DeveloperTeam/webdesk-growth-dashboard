import type {
  ProjectEntity,
  ProjectRepository,
  RoadmapItemEntity,
  RoadmapItemRepository,
} from "@webdesk/database";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import { ProjectService } from "./project.service.js";

// withTransaction() opens a real Sequelize connection (needs DATABASE_URL) — irrelevant to this
// service's own logic, so it's stubbed to just invoke the callback, matching how every other
// mocked repository call in this file already replaces DB access with a plain function.
vi.mock("@webdesk/database", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- vitest's importOriginal<T>() needs the actual module's type inline; no top-level type-only equivalent exists for this generic parameter.
  const actual = await importOriginal<typeof import("@webdesk/database")>();
  return {
    ...actual,
    withTransaction: vi.fn((fn: (transaction: unknown) => unknown) =>
      fn({ fakeTransaction: true }),
    ),
  };
});

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
    createdBy: "actor-1",
    updatedBy: "actor-1",
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
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ProjectService", () => {
  let projects: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
  };
  let roadmapItems: { findById: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let service: ProjectService;

  beforeEach(() => {
    projects = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPublicId: vi.fn(),
      update: vi.fn(),
      list: vi.fn(),
    };
    roadmapItems = { findById: vi.fn(), update: vi.fn() };
    auditService = { record: vi.fn() };
    service = new ProjectService(
      projects as unknown as ProjectRepository,
      roadmapItems as unknown as RoadmapItemRepository,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("rejects a duplicate publicId", async () => {
      projects.findByPublicId.mockResolvedValue(project());
      await expect(
        service.create({ publicId: "acme-website", name: "Acme" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(projects.create).not.toHaveBeenCalled();
    });

    it("creates a project and records an audit event", async () => {
      projects.findByPublicId.mockResolvedValue(null);
      projects.create.mockResolvedValue(project());

      const result = await service.create({ publicId: "acme-website", name: "Acme" }, "actor-1");

      expect(result.id).toBe("project-1");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "data_change",
          action: "create",
          projectId: "project-1",
        }),
      );
    });
  });

  describe("changeStatus", () => {
    it("allows active -> paused", async () => {
      projects.findById.mockResolvedValue(project({ status: "active" }));
      projects.update.mockResolvedValue(project({ status: "paused" }));

      const result = await service.changeStatus("project-1", "paused", "actor-1");

      expect(result.status).toBe("paused");
      expect(projects.update).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({ status: "paused" }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "project_status_changed",
          beforeState: { status: "active" },
          afterState: { status: "paused" },
        }),
      );
    });

    it("allows paused -> active", async () => {
      projects.findById.mockResolvedValue(project({ status: "paused" }));
      projects.update.mockResolvedValue(project({ status: "active" }));

      const result = await service.changeStatus("project-1", "active", "actor-1");
      expect(result.status).toBe("active");
    });

    it("allows active -> archived", async () => {
      projects.findById.mockResolvedValue(project({ status: "active" }));
      projects.update.mockResolvedValue(project({ status: "archived" }));

      const result = await service.changeStatus("project-1", "archived", "actor-1");
      expect(result.status).toBe("archived");
    });

    it("rejects archived -> active (archived is terminal, D2)", async () => {
      projects.findById.mockResolvedValue(project({ status: "archived" }));

      await expect(service.changeStatus("project-1", "active", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(projects.update).not.toHaveBeenCalled();
    });

    it("rejects archived -> paused (archived is terminal, D2)", async () => {
      projects.findById.mockResolvedValue(project({ status: "archived" }));

      await expect(service.changeStatus("project-1", "paused", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("is a no-op when the requested status equals the current status", async () => {
      projects.findById.mockResolvedValue(project({ status: "active" }));

      const result = await service.changeStatus("project-1", "active", "actor-1");

      expect(result.status).toBe("active");
      expect(projects.update).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for a missing project", async () => {
      projects.findById.mockResolvedValue(null);
      await expect(service.changeStatus("missing", "paused", "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("setActivePhase", () => {
    it("rejects a roadmap item belonging to a different project (D3)", async () => {
      projects.findById.mockResolvedValue(project());
      roadmapItems.findById.mockResolvedValue(roadmapItem({ projectId: "other-project" }));

      await expect(service.setActivePhase("project-1", "phase-1", "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(projects.update).not.toHaveBeenCalled();
    });

    it("clears the previously active phase before setting the new one (D3 invariant)", async () => {
      projects.findById.mockResolvedValue(project({ activePhaseId: "phase-old" }));
      roadmapItems.findById.mockResolvedValue(roadmapItem({ id: "phase-new" }));
      projects.update.mockResolvedValue(project({ activePhaseId: "phase-new" }));

      await service.setActivePhase("project-1", "phase-new", "actor-1");

      expect(roadmapItems.update).toHaveBeenCalledWith(
        "phase-old",
        "project-1",
        expect.objectContaining({ status: "not_started" }),
        expect.anything(),
      );
      expect(roadmapItems.update).toHaveBeenCalledWith(
        "phase-new",
        "project-1",
        expect.objectContaining({ status: "active" }),
        expect.anything(),
      );
      expect(projects.update).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({ activePhaseId: "phase-new" }),
        expect.anything(),
      );
    });

    it("clearing the active phase (null) unsets the previous one without setting a new one", async () => {
      projects.findById.mockResolvedValue(project({ activePhaseId: "phase-old" }));
      projects.update.mockResolvedValue(project({ activePhaseId: null }));

      await service.setActivePhase("project-1", null, "actor-1");

      expect(roadmapItems.findById).not.toHaveBeenCalled();
      expect(roadmapItems.update).toHaveBeenCalledWith(
        "phase-old",
        "project-1",
        expect.objectContaining({ status: "not_started" }),
        expect.anything(),
      );
      expect(roadmapItems.update).toHaveBeenCalledTimes(1);
    });
  });
});
