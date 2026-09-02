import type { ImportRowEntity, ImportRowRepository } from "@webdesk/database";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportRowsService } from "./import-rows.service.js";

const NOW = new Date("2026-09-02T00:00:00.000Z");

function row(overrides: Partial<ImportRowEntity> = {}): ImportRowEntity {
  return {
    id: "row-1",
    importRunId: "run-1",
    rowNumber: 1,
    externalId: null,
    rawData: null,
    status: "pending",
    resolution: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ImportRowsService", () => {
  let rows: { findById: ReturnType<typeof vi.fn>; list: ReturnType<typeof vi.fn> };
  let svc: ImportRowsService;

  beforeEach(() => {
    rows = { findById: vi.fn(), list: vi.fn() };
    svc = new ImportRowsService(rows as unknown as ImportRowRepository);
  });

  describe("findById", () => {
    it("returns a row belonging to the given run", async () => {
      rows.findById.mockResolvedValue(row());
      const result = await svc.findById("row-1", "run-1");
      expect(result.id).toBe("row-1");
    });

    it("throws NotFoundException for a row belonging to a different run (IDOR)", async () => {
      rows.findById.mockResolvedValue(row({ importRunId: "other-run" }));
      await expect(svc.findById("row-1", "run-1")).rejects.toThrow(NotFoundException);
    });

    it("throws NotFoundException for a missing row", async () => {
      rows.findById.mockResolvedValue(null);
      await expect(svc.findById("missing", "run-1")).rejects.toThrow(NotFoundException);
    });
  });

  describe("list", () => {
    it("delegates to the repository", async () => {
      rows.list.mockResolvedValue([row()]);
      const result = await svc.list({ importRunId: "run-1" });
      expect(result).toHaveLength(1);
      expect(rows.list).toHaveBeenCalledWith({ importRunId: "run-1" });
    });
  });
});
