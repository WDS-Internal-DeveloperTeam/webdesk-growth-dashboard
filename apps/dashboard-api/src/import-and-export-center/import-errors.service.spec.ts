import type { ImportErrorEntity, ImportErrorRepository } from "@webdesk/database";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportErrorsService } from "./import-errors.service.js";

const NOW = new Date("2026-09-02T00:00:00.000Z");

function error(overrides: Partial<ImportErrorEntity> = {}): ImportErrorEntity {
  return {
    id: "error-1",
    importRunId: "run-1",
    importRowId: null,
    errorCode: null,
    message: "file not found",
    fieldName: null,
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ImportErrorsService", () => {
  let errors: { findById: ReturnType<typeof vi.fn>; list: ReturnType<typeof vi.fn> };
  let svc: ImportErrorsService;

  beforeEach(() => {
    errors = { findById: vi.fn(), list: vi.fn() };
    svc = new ImportErrorsService(errors as unknown as ImportErrorRepository);
  });

  describe("findById", () => {
    it("returns an error belonging to the given run", async () => {
      errors.findById.mockResolvedValue(error());
      const result = await svc.findById("error-1", "run-1");
      expect(result.id).toBe("error-1");
    });

    it("throws NotFoundException for an error belonging to a different run (IDOR)", async () => {
      errors.findById.mockResolvedValue(error({ importRunId: "other-run" }));
      await expect(svc.findById("error-1", "run-1")).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException for a missing error", async () => {
      errors.findById.mockResolvedValue(null);
      await expect(svc.findById("missing", "run-1")).rejects.toThrow(NotFoundException);
    });
  });

  describe("list", () => {
    it("delegates to the repository", async () => {
      errors.list.mockResolvedValue([error()]);
      const result = await svc.list({ importRunId: "run-1" });
      expect(result).toHaveLength(1);
      expect(errors.list).toHaveBeenCalledWith({ importRunId: "run-1" });
    });
  });
});
