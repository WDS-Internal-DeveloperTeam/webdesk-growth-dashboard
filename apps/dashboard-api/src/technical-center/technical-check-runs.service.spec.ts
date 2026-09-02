import type {
  TechnicalCheckDefinitionEntity,
  TechnicalCheckRunEntity,
  TechnicalCheckRunRepository,
  TechnicalFindingRepository,
} from "@webdesk/database";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import type { TechnicalCheckDefinitionsService } from "./technical-check-definitions.service.js";
import { TechnicalCheckRunsService } from "./technical-check-runs.service.js";

const NOW = new Date("2026-09-02T00:00:00.000Z");
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PROJECT_ID = "99999999-9999-4999-8999-999999999999";
const DEFINITION_ID = "22222222-2222-4222-8222-222222222222";

function definition(
  overrides: Partial<TechnicalCheckDefinitionEntity> = {},
): TechnicalCheckDefinitionEntity {
  return {
    id: DEFINITION_ID,
    projectId: PROJECT_ID,
    publicId: "TC-LINT",
    name: "Lint check",
    checkType: "linting",
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

function run(overrides: Partial<TechnicalCheckRunEntity> = {}): TechnicalCheckRunEntity {
  return {
    id: "run-1",
    projectId: PROJECT_ID,
    publicId: "TCRUN-1",
    technicalCheckDefinitionId: DEFINITION_ID,
    status: "requested",
    triggerType: "manual",
    startedAt: null,
    completedAt: null,
    errorSummary: null,
    requestedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("TechnicalCheckRunsService", () => {
  let runs: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let findings: { bulkCreate: ReturnType<typeof vi.fn> };
  let definitions: { findById: ReturnType<typeof vi.fn> };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: TechnicalCheckRunsService;

  beforeEach(() => {
    runs = { create: vi.fn(), findById: vi.fn(), list: vi.fn(), updateStatus: vi.fn() };
    findings = { bulkCreate: vi.fn() };
    definitions = { findById: vi.fn().mockResolvedValue(definition()) };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new TechnicalCheckRunsService(
      runs as unknown as TechnicalCheckRunRepository,
      findings as unknown as TechnicalFindingRepository,
      definitions as unknown as TechnicalCheckDefinitionsService,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    const input = {
      technicalCheckDefinitionId: DEFINITION_ID,
      publicId: "TCRUN-1",
      triggerType: "manual" as const,
    };

    it("creates a run against an enabled definition", async () => {
      runs.create.mockResolvedValue(run());
      const result = await svc.create(PROJECT_ID, input, "actor-1");
      expect(result.status).toBe("requested");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "data_change", action: "create" }),
      );
    });

    it("rejects a run against a disabled definition", async () => {
      definitions.findById.mockResolvedValue(definition({ isEnabled: false }));
      await expect(svc.create(PROJECT_ID, input, "actor-1")).rejects.toThrow(BadRequestException);
      expect(runs.create).not.toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    it("throws NotFoundException for a run in a different project (IDOR)", async () => {
      runs.findById.mockResolvedValue(run({ projectId: OTHER_PROJECT_ID }));
      await expect(svc.findById("run-1", PROJECT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe("changeStatus", () => {
    it("returns the run unchanged and does no work on a same-status request", async () => {
      runs.findById.mockResolvedValue(run());
      const result = await svc.changeStatus(
        "run-1",
        PROJECT_ID,
        { status: "requested" },
        "actor-1",
      );
      expect(result.status).toBe("requested");
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
      expect(runs.updateStatus).not.toHaveBeenCalled();
    });

    it("rejects an invalid transition", async () => {
      runs.findById.mockResolvedValue(run({ status: "requested" }));
      await expect(
        svc.changeStatus("run-1", PROJECT_ID, { status: "completed" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("requires the edit action and performs an atomic status transition", async () => {
      runs.findById.mockResolvedValue(run({ status: "requested" }));
      runs.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: run({ status: "queued" }),
      });

      const result = await svc.changeStatus("run-1", PROJECT_ID, { status: "queued" }, "actor-1");

      expect(result.status).toBe("queued");
      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "development_code",
        "edit",
        PROJECT_ID,
      );
    });

    it("surfaces a concurrent status change as a clean 409", async () => {
      runs.findById.mockResolvedValue(run({ status: "requested" }));
      runs.updateStatus.mockResolvedValue({
        outcome: "conflict",
        entity: run({ status: "cancelled" }),
      });

      await expect(
        svc.changeStatus("run-1", PROJECT_ID, { status: "queued" }, "actor-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("rejects findings supplied alongside a non-terminal transition", async () => {
      runs.findById.mockResolvedValue(run({ status: "requested" }));
      await expect(
        svc.changeStatus(
          "run-1",
          PROJECT_ID,
          { status: "queued", findings: [{ severity: "high", title: "Broken build" }] },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(runs.updateStatus).not.toHaveBeenCalled();
    });

    it("creates findings when transitioning to completed with a non-empty findings payload", async () => {
      runs.findById.mockResolvedValue(run({ status: "running" }));
      runs.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: run({ status: "completed", publicId: "TCRUN-1" }),
      });
      findings.bulkCreate.mockResolvedValue([{ id: "finding-1" }, { id: "finding-2" }]);

      await svc.changeStatus(
        "run-1",
        PROJECT_ID,
        {
          status: "completed",
          findings: [
            { severity: "critical", title: "3 known CVEs" },
            { severity: "low", title: "Coverage below threshold" },
          ],
        },
        "actor-1",
      );

      expect(findings.bulkCreate).toHaveBeenCalledTimes(1);
      expect(findings.bulkCreate).toHaveBeenCalledWith([
        expect.objectContaining({
          projectId: PROJECT_ID,
          technicalCheckRunId: "run-1",
          severity: "critical",
        }),
        expect.objectContaining({
          projectId: PROJECT_ID,
          technicalCheckRunId: "run-1",
          severity: "low",
        }),
      ]);
    });

    it("does not fail the transition if finding creation throws (logged, not rethrown)", async () => {
      runs.findById.mockResolvedValue(run({ status: "running" }));
      runs.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: run({ status: "completed" }),
      });
      findings.bulkCreate.mockRejectedValue(new Error("db down"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const result = await svc.changeStatus(
        "run-1",
        PROJECT_ID,
        { status: "completed", findings: [{ severity: "high", title: "X" }] },
        "actor-1",
      );

      expect(result.status).toBe("completed");
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("allows cancelling directly from requested (shortcut edge)", async () => {
      runs.findById.mockResolvedValue(run({ status: "requested" }));
      runs.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: run({ status: "cancelled" }),
      });

      const result = await svc.changeStatus(
        "run-1",
        PROJECT_ID,
        { status: "cancelled" },
        "actor-1",
      );
      expect(result.status).toBe("cancelled");
    });
  });
});
