import type {
  ImportErrorRepository,
  ImportRowRepository,
  ImportRunEntity,
  ImportRunRepository,
  ImportTemplateEntity,
} from "@webdesk/database";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import type { ImportTemplatesService } from "./import-templates.service.js";
import { ImportRunsService } from "./import-runs.service.js";

const NOW = new Date("2026-09-02T00:00:00.000Z");
const TEMPLATE_ID = "template-1";

function template(overrides: Partial<ImportTemplateEntity> = {}): ImportTemplateEntity {
  return {
    id: TEMPLATE_ID,
    publicId: "TPL-1",
    name: "Keyword CSV v2",
    targetModuleKey: "keyword_and_entity_library",
    columnMapping: null,
    duplicateStrategyDefault: "skip",
    fileFormat: "csv",
    version: 3,
    isActive: true,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function run(overrides: Partial<ImportRunEntity> = {}): ImportRunEntity {
  return {
    id: "run-1",
    publicId: "RUN-1",
    importTemplateId: TEMPLATE_ID,
    templateVersion: 3,
    isDryRun: true,
    duplicateStrategy: null,
    sourceFileReference: null,
    sourceChecksum: null,
    status: "draft",
    totalRows: 0,
    successCount: 0,
    errorCount: 0,
    skippedCount: 0,
    errorSummary: null,
    rollbackNotes: null,
    startedAt: null,
    completedAt: null,
    requestedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ImportRunsService", () => {
  let runs: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
    countByStatus: ReturnType<typeof vi.fn>;
    applyRowCounts: ReturnType<typeof vi.fn>;
  };
  let rows: { bulkCreate: ReturnType<typeof vi.fn> };
  let errors: { bulkCreate: ReturnType<typeof vi.fn> };
  let templates: { findById: ReturnType<typeof vi.fn> };
  let authorizationService: { assertAllowed: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: ImportRunsService;

  beforeEach(() => {
    runs = {
      create: vi.fn(),
      findById: vi.fn(),
      list: vi.fn(),
      updateStatus: vi.fn(),
      countByStatus: vi.fn(),
      applyRowCounts: vi.fn(),
    };
    rows = { bulkCreate: vi.fn() };
    errors = { bulkCreate: vi.fn() };
    templates = { findById: vi.fn().mockResolvedValue(template()) };
    authorizationService = { assertAllowed: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new ImportRunsService(
      runs as unknown as ImportRunRepository,
      rows as unknown as ImportRowRepository,
      errors as unknown as ImportErrorRepository,
      templates as unknown as ImportTemplatesService,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    const input = {
      importTemplateId: TEMPLATE_ID,
      publicId: "RUN-1",
      isDryRun: true,
    };

    it("creates a run snapshotting the template's current version", async () => {
      runs.create.mockResolvedValue(run());
      const result = await svc.create(input, "actor-1");
      expect(result.status).toBe("draft");
      expect(runs.create).toHaveBeenCalledWith(
        expect.objectContaining({ importTemplateId: TEMPLATE_ID, templateVersion: 3 }),
      );
    });

    it("rejects a run against a disabled template", async () => {
      templates.findById.mockResolvedValue(template({ isActive: false }));
      await expect(svc.create(input, "actor-1")).rejects.toThrow(BadRequestException);
      expect(runs.create).not.toHaveBeenCalled();
    });
  });

  describe("changeStatus", () => {
    it("returns the run unchanged and does no work on a same-status request", async () => {
      runs.findById.mockResolvedValue(run({ status: "draft" }));
      const result = await svc.changeStatus("run-1", { status: "draft" }, "actor-1");
      expect(result.status).toBe("draft");
      expect(authorizationService.assertAllowed).not.toHaveBeenCalled();
      expect(runs.updateStatus).not.toHaveBeenCalled();
    });

    it("rejects an invalid transition", async () => {
      runs.findById.mockResolvedValue(run({ status: "draft" }));
      await expect(svc.changeStatus("run-1", { status: "importing" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
    });

    it("requires the submit action for draft -> submitted", async () => {
      runs.findById.mockResolvedValue(run({ status: "draft" }));
      runs.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: run({ status: "submitted" }),
      });

      await svc.changeStatus("run-1", { status: "submitted" }, "actor-1");

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "imports",
        "submit",
      );
    });

    it("requires the approve action for {completed} -> rolled_back", async () => {
      runs.findById.mockResolvedValue(run({ status: "completed" }));
      runs.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: run({ status: "rolled_back" }),
      });

      await svc.changeStatus(
        "run-1",
        { status: "rolled_back", rollbackNotes: "reverted the theme change" },
        "actor-1",
      );

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "actor-1",
        "imports",
        "approve",
      );
    });

    it("surfaces a concurrent status change as a clean 409", async () => {
      runs.findById.mockResolvedValue(run({ status: "draft" }));
      runs.updateStatus.mockResolvedValue({
        outcome: "conflict",
        entity: run({ status: "cancelled" }),
      });

      await expect(svc.changeStatus("run-1", { status: "submitted" }, "actor-1")).rejects.toThrow(
        ConflictException,
      );
    });

    it("rejects rollbackNotes supplied alongside a non-rollback transition", async () => {
      runs.findById.mockResolvedValue(run({ status: "draft" }));
      await expect(
        svc.changeStatus(
          "run-1",
          { status: "submitted", rollbackNotes: "not applicable here" },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(runs.updateStatus).not.toHaveBeenCalled();
    });

    it("rejects validating -> dry_run_completed when the run isn't a dry run", async () => {
      runs.findById.mockResolvedValue(run({ status: "validating", isDryRun: false }));
      await expect(
        svc.changeStatus("run-1", { status: "dry_run_completed" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(runs.updateStatus).not.toHaveBeenCalled();
    });

    it("rejects validating -> importing directly for a dry run (must go through dry_run_completed)", async () => {
      runs.findById.mockResolvedValue(run({ status: "validating", isDryRun: true }));
      await expect(svc.changeStatus("run-1", { status: "importing" }, "actor-1")).rejects.toThrow(
        BadRequestException,
      );
      expect(runs.updateStatus).not.toHaveBeenCalled();
    });

    it("rejects rows supplied alongside a non-terminal-with-rows transition", async () => {
      runs.findById.mockResolvedValue(run({ status: "draft" }));
      await expect(
        svc.changeStatus(
          "run-1",
          { status: "submitted", rows: [{ rowNumber: 1, status: "valid" }] },
          "actor-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(runs.updateStatus).not.toHaveBeenCalled();
    });

    it("bulk-creates rows and recomputes counts when transitioning to importing", async () => {
      runs.findById.mockResolvedValue(run({ status: "validating", isDryRun: false }));
      runs.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: run({ status: "importing" }),
      });
      rows.bulkCreate.mockResolvedValue([{ id: "row-1" }, { id: "row-2" }]);
      runs.countByStatus.mockResolvedValue({
        pending: 0,
        valid: 0,
        invalid: 1,
        imported: 1,
        skipped: 0,
        failed: 0,
      });
      runs.findById.mockResolvedValueOnce(run({ status: "validating", isDryRun: false }));
      runs.findById.mockResolvedValueOnce(
        run({ status: "importing", totalRows: 2, successCount: 1, errorCount: 1 }),
      );

      const result = await svc.changeStatus(
        "run-1",
        {
          status: "importing",
          rows: [
            { rowNumber: 1, status: "imported" },
            { rowNumber: 2, status: "invalid", errorMessage: "missing email" },
          ],
        },
        "actor-1",
      );

      expect(rows.bulkCreate).toHaveBeenCalledTimes(1);
      // The row-specific error must link back to the ACTUAL created row's id (from bulkCreate's own
      // return value, correlated by array index) — row 2 ("missing email") is the second input, so
      // it must carry "row-2", the id bulkCreate() returned for that position, not be left null.
      expect(errors.bulkCreate).toHaveBeenCalledWith([
        expect.objectContaining({
          importRunId: "run-1",
          importRowId: "row-2",
          message: "missing email",
        }),
      ]);
      expect(runs.countByStatus).toHaveBeenCalledWith("run-1");
      expect(runs.applyRowCounts).toHaveBeenCalledWith("run-1", expect.any(Object));
      expect(result.totalRows).toBe(2);
    });

    it("does not fail the transition if row creation throws (logged, not rethrown)", async () => {
      runs.findById.mockResolvedValue(run({ status: "validating", isDryRun: false }));
      runs.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: run({ status: "importing" }),
      });
      rows.bulkCreate.mockRejectedValue(new Error("db down"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const result = await svc.changeStatus(
        "run-1",
        { status: "importing", rows: [{ rowNumber: 1, status: "imported" }] },
        "actor-1",
      );

      expect(result.status).toBe("importing");
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("bulk-creates run-level errors independent of any row payload", async () => {
      runs.findById.mockResolvedValue(run({ status: "validating", isDryRun: false }));
      runs.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: run({ status: "importing" }),
      });

      await svc.changeStatus(
        "run-1",
        { status: "importing", runErrors: [{ message: "file not found" }] },
        "actor-1",
      );

      expect(errors.bulkCreate).toHaveBeenCalledWith([
        expect.objectContaining({
          importRunId: "run-1",
          importRowId: null,
          message: "file not found",
        }),
      ]);
    });
  });
});
