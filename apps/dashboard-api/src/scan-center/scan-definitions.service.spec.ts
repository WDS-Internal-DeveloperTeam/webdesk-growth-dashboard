import type { ScanDefinitionEntity, ScanDefinitionRepository } from "@webdesk/database";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { ProjectService } from "../projects/project.service.js";
import { ScanDefinitionsService } from "./scan-definitions.service.js";

const NOW = new Date("2026-09-01T00:00:00.000Z");
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PROJECT_ID = "99999999-9999-4999-8999-999999999999";

function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function definition(overrides: Partial<ScanDefinitionEntity> = {}): ScanDefinitionEntity {
  return {
    id: "def-1",
    projectId: PROJECT_ID,
    publicId: "SCAN-FULL-SITE",
    name: "Full site scan",
    scanType: "full_website",
    mode: "manual",
    target: null,
    environment: null,
    scheduleCron: null,
    isEnabled: true,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ScanDefinitionsService", () => {
  let repo: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByPublicId: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let projects: { findById: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: ScanDefinitionsService;

  beforeEach(() => {
    repo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByPublicId: vi.fn(),
      list: vi.fn(),
      update: vi.fn(),
    };
    projects = { findById: vi.fn().mockResolvedValue({ id: PROJECT_ID }) };
    auditService = { record: vi.fn() };
    svc = new ScanDefinitionsService(
      repo as unknown as ScanDefinitionRepository,
      projects as unknown as ProjectService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    const input = {
      publicId: "SCAN-FULL-SITE",
      name: "Full site scan",
      scanType: "full_website" as const,
    };

    it("creates a definition and records an audit event", async () => {
      repo.findByPublicId.mockResolvedValue(null);
      repo.create.mockResolvedValue(definition());

      const result = await svc.create(PROJECT_ID, input, "actor-1");

      expect(result.name).toBe("Full site scan");
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ projectId: PROJECT_ID, createdBy: "actor-1" }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "data_change", action: "create" }),
      );
    });

    it("rejects a duplicate publicId with a clean 400", async () => {
      repo.findByPublicId.mockResolvedValue(definition());

      await expect(svc.create(PROJECT_ID, input, "actor-1")).rejects.toThrow(BadRequestException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("converts a TOCTOU unique-constraint race into a clean 400", async () => {
      repo.findByPublicId.mockResolvedValue(null);
      repo.create.mockRejectedValue(uniqueConstraintError());

      await expect(svc.create(PROJECT_ID, input, "actor-1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("findById", () => {
    it("returns the definition when it belongs to the given project", async () => {
      repo.findById.mockResolvedValue(definition());
      const result = await svc.findById("def-1", PROJECT_ID);
      expect(result.id).toBe("def-1");
    });

    it("throws NotFoundException when the definition belongs to a different project (IDOR)", async () => {
      repo.findById.mockResolvedValue(definition({ projectId: OTHER_PROJECT_ID }));
      await expect(svc.findById("def-1", PROJECT_ID)).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException when the definition does not exist", async () => {
      repo.findById.mockResolvedValue(null);
      await expect(svc.findById("missing", PROJECT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("updates a definition and records an audit event", async () => {
      repo.findById.mockResolvedValue(definition());
      repo.update.mockResolvedValue(definition({ name: "Renamed scan" }));

      const result = await svc.update("def-1", PROJECT_ID, { name: "Renamed scan" }, "actor-1");

      expect(result.name).toBe("Renamed scan");
      expect(repo.update).toHaveBeenCalledWith(
        "def-1",
        expect.objectContaining({ name: "Renamed scan", updatedBy: "actor-1" }),
      );
      expect(auditService.record).toHaveBeenCalled();
    });

    it("throws NotFoundException for a definition in a different project", async () => {
      repo.findById.mockResolvedValue(definition({ projectId: OTHER_PROJECT_ID }));
      await expect(svc.update("def-1", PROJECT_ID, { name: "x" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.update).not.toHaveBeenCalled();
    });
  });
});
