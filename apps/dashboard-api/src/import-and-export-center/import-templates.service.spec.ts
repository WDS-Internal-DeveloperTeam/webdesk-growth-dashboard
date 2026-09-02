import type { ImportTemplateEntity, ImportTemplateRepository } from "@webdesk/database";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import { ImportTemplatesService } from "./import-templates.service.js";

const NOW = new Date("2026-09-02T00:00:00.000Z");

function template(overrides: Partial<ImportTemplateEntity> = {}): ImportTemplateEntity {
  return {
    id: "template-1",
    publicId: "TPL-1",
    name: "Keyword CSV v2",
    targetModuleKey: "keyword_and_entity_library",
    columnMapping: null,
    duplicateStrategyDefault: "skip",
    fileFormat: "csv",
    version: 1,
    isActive: true,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ImportTemplatesService", () => {
  let templates: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let authorizationService: { isValidModuleKey: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: ImportTemplatesService;

  beforeEach(() => {
    templates = { create: vi.fn(), findById: vi.fn(), list: vi.fn(), update: vi.fn() };
    authorizationService = { isValidModuleKey: vi.fn().mockResolvedValue(true) };
    auditService = { record: vi.fn() };
    svc = new ImportTemplatesService(
      templates as unknown as ImportTemplateRepository,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    const input = {
      publicId: "TPL-1",
      name: "Keyword CSV v2",
      targetModuleKey: "keyword_and_entity_library",
      fileFormat: "csv" as const,
    };

    it("creates a template against a valid target module", async () => {
      templates.create.mockResolvedValue(template());
      const result = await svc.create(input, "actor-1");
      expect(result.targetModuleKey).toBe("keyword_and_entity_library");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "data_change", action: "create" }),
      );
    });

    it("rejects a targetModuleKey that doesn't resolve to a real module", async () => {
      authorizationService.isValidModuleKey.mockResolvedValue(false);
      await expect(svc.create(input, "actor-1")).rejects.toThrow(BadRequestException);
      expect(templates.create).not.toHaveBeenCalled();
    });

    it("surfaces a duplicate publicId as a clean 400", async () => {
      const error = Object.assign(new Error("dup"), { name: "SequelizeUniqueConstraintError" });
      templates.create.mockRejectedValue(error);
      await expect(svc.create(input, "actor-1")).rejects.toThrow(BadRequestException);
    });
  });

  describe("findById", () => {
    it("throws NotFoundException for a missing template", async () => {
      templates.findById.mockResolvedValue(null);
      await expect(svc.findById("missing")).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("updates content and increments version at the repository layer", async () => {
      templates.findById.mockResolvedValue(template());
      templates.update.mockResolvedValue(template({ name: "Renamed", version: 2 }));

      const result = await svc.update("template-1", { name: "Renamed" }, "actor-1");

      expect(result.version).toBe(2);
      expect(templates.update).toHaveBeenCalledWith(
        "template-1",
        expect.objectContaining({ name: "Renamed", updatedBy: "actor-1" }),
      );
    });

    it("throws NotFoundException when the template disappears mid-update", async () => {
      templates.findById.mockResolvedValue(template());
      templates.update.mockResolvedValue(null);
      await expect(svc.update("template-1", { name: "X" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
