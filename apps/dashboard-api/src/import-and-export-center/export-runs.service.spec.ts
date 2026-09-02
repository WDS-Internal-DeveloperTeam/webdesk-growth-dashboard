import type { ExportRunEntity, ExportRunRepository } from "@webdesk/database";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import { ExportRunsService } from "./export-runs.service.js";

const NOW = new Date("2026-09-02T00:00:00.000Z");

function run(overrides: Partial<ExportRunEntity> = {}): ExportRunEntity {
  return {
    id: "export-1",
    publicId: "EXP-1",
    targetModuleKey: "keyword_and_entity_library",
    filterCriteria: null,
    format: "csv",
    status: "requested",
    rowCount: null,
    fileReference: null,
    excludesConfidentialFields: true,
    errorSummary: null,
    startedAt: null,
    completedAt: null,
    requestedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ExportRunsService", () => {
  let runs: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let authorizationService: {
    isValidModuleKey: ReturnType<typeof vi.fn>;
    assertAllowed: ReturnType<typeof vi.fn>;
  };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: ExportRunsService;

  beforeEach(() => {
    runs = { create: vi.fn(), findById: vi.fn(), list: vi.fn(), updateStatus: vi.fn() };
    authorizationService = {
      isValidModuleKey: vi.fn().mockResolvedValue(true),
      assertAllowed: vi.fn(),
    };
    auditService = { record: vi.fn() };
    svc = new ExportRunsService(
      runs as unknown as ExportRunRepository,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    const input = {
      publicId: "EXP-1",
      targetModuleKey: "keyword_and_entity_library",
      format: "csv" as const,
    };

    it("creates an export run against a valid target module", async () => {
      runs.create.mockResolvedValue(run());
      const result = await svc.create(input, "actor-1");
      expect(result.status).toBe("requested");
      expect(result.excludesConfidentialFields).toBe(true);
    });

    it("rejects a targetModuleKey that doesn't resolve to a real module", async () => {
      authorizationService.isValidModuleKey.mockResolvedValue(false);
      await expect(svc.create(input, "actor-1")).rejects.toThrow(BadRequestException);
      expect(runs.create).not.toHaveBeenCalled();
    });
  });

  describe("changeStatus", () => {
    it("returns the run unchanged and does no work on a same-status request", async () => {
      runs.findById.mockResolvedValue(run({ status: "requested" }));
      const result = await svc.changeStatus("export-1", { status: "requested" }, "actor-1");
      expect(result.status).toBe("requested");
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
    });

    it("rejects an invalid transition", async () => {
      runs.findById.mockResolvedValue(run({ status: "requested" }));
      await expect(
        svc.changeStatus("export-1", { status: "completed" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("requires the export action for every transition", async () => {
      runs.findById.mockResolvedValue(run({ status: "requested" }));
      runs.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: run({ status: "processing" }),
      });

      await svc.changeStatus("export-1", { status: "processing" }, "actor-1");

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "exports",
        "export",
      );
    });

    it("surfaces a concurrent status change as a clean 409", async () => {
      runs.findById.mockResolvedValue(run({ status: "requested" }));
      runs.updateStatus.mockResolvedValue({
        outcome: "conflict",
        entity: run({ status: "cancelled" }),
      });

      await expect(
        svc.changeStatus("export-1", { status: "processing" }, "actor-1"),
      ).rejects.toThrow(ConflictException);
    });
  });
});
