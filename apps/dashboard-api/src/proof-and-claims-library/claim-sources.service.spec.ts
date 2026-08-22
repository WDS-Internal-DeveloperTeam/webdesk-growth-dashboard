import type { ClaimSourceEntity, ClaimSourceRepository } from "@webdesk/database";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import { ClaimSourcesService } from "./claim-sources.service.js";

const NOW = new Date("2026-08-22T00:00:00.000Z");

function source(overrides: Partial<ClaimSourceEntity> = {}): ClaimSourceEntity {
  return {
    id: "source-1",
    claimId: "claim-1",
    source: "Third-party audit report, 2026",
    sourceUrl: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ClaimSourcesService", () => {
  let claimSources: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    listByClaim: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: ClaimSourcesService;

  beforeEach(() => {
    claimSources = {
      create: vi.fn(),
      findById: vi.fn(),
      listByClaim: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    auditService = { record: vi.fn() };
    svc = new ClaimSourcesService(
      claimSources as unknown as ClaimSourceRepository,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a source under the given claim and records an audit event", async () => {
      claimSources.create.mockResolvedValue(source());

      const result = await svc.create(
        "claim-1",
        { source: "Third-party audit report, 2026" },
        "actor-1",
      );

      expect(result).toEqual(source());
      expect(claimSources.create).toHaveBeenCalledWith(
        expect.objectContaining({ claimId: "claim-1" }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "claim_source" }),
      );
    });
  });

  describe("findById", () => {
    it("throws NotFoundException when the source does not exist", async () => {
      claimSources.findById.mockResolvedValue(null);
      await expect(svc.findById("missing")).rejects.toThrow(NotFoundException);
    });

    it("returns the source when it exists", async () => {
      claimSources.findById.mockResolvedValue(source());
      await expect(svc.findById("source-1")).resolves.toEqual(source());
    });
  });

  describe("listByClaim", () => {
    it("delegates straight through to the repository", async () => {
      claimSources.listByClaim.mockResolvedValue([source()]);
      const result = await svc.listByClaim("claim-1");
      expect(claimSources.listByClaim).toHaveBeenCalledWith("claim-1");
      expect(result).toEqual([source()]);
    });
  });

  describe("update", () => {
    it("updates a source scoped to its claim and records an audit event", async () => {
      claimSources.update.mockResolvedValue(source({ source: "Revised" }));

      const result = await svc.update("source-1", "claim-1", { source: "Revised" }, "actor-1");

      expect(result.source).toBe("Revised");
      expect(claimSources.update).toHaveBeenCalledWith("source-1", "claim-1", {
        source: "Revised",
      });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "update", entityType: "claim_source" }),
      );
    });

    it("throws NotFoundException when the repository reports nothing was updated (wrong claim or missing id)", async () => {
      claimSources.update.mockResolvedValue(null);

      await expect(
        svc.update("source-1", "different-claim", { source: "X" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("removes a source belonging to the given claim and records an audit event", async () => {
      claimSources.findById.mockResolvedValue(source({ claimId: "claim-1" }));
      claimSources.remove.mockResolvedValue(true);

      await svc.remove("source-1", "claim-1", "actor-1");

      expect(claimSources.remove).toHaveBeenCalledWith("source-1", "claim-1");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "delete", entityType: "claim_source" }),
      );
    });

    it("throws NotFoundException (IDOR prevention) when the source belongs to a different claim", async () => {
      claimSources.findById.mockResolvedValue(source({ claimId: "claim-1" }));

      await expect(svc.remove("source-1", "different-claim", "actor-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(claimSources.remove).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the source does not exist at all", async () => {
      claimSources.findById.mockResolvedValue(null);

      await expect(svc.remove("missing", "claim-1", "actor-1")).rejects.toThrow(NotFoundException);
    });
  });
});
