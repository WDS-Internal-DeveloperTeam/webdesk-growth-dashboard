import type { RetentionHoldEntity, RetentionHoldRepository } from "@webdesk/database";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import { RetentionHoldService } from "./retention-hold.service.js";

const NOW = new Date("2026-08-13T00:00:00.000Z");

function activeHold(overrides: Partial<RetentionHoldEntity> = {}): RetentionHoldEntity {
  return {
    id: "hold-1",
    scope: "entity",
    resourceType: "jobs",
    resourceId: "job-1",
    categoryKey: null,
    reasonCategory: "legal",
    reason: "litigation hold",
    createdByUserId: "actor-1",
    approvedByUserId: null,
    startDate: NOW.toISOString(),
    endDate: null,
    status: "active",
    releaseReason: null,
    releasedByUserId: null,
    releasedAt: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("RetentionHoldService", () => {
  let holds: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
    listAll: ReturnType<typeof vi.fn>;
  };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let service: RetentionHoldService;

  beforeEach(() => {
    holds = { create: vi.fn(), findById: vi.fn(), release: vi.fn(), listAll: vi.fn() };
    auditService = { record: vi.fn() };
    service = new RetentionHoldService(
      holds as unknown as RetentionHoldRepository,
      auditService as unknown as AuditService,
    );
  });

  describe("createHold", () => {
    it("creates an entity-scoped hold and records an audit event", async () => {
      holds.create.mockResolvedValue(activeHold());
      const result = await service.createHold({
        scope: "entity",
        resourceType: "jobs",
        resourceId: "job-1",
        reasonCategory: "legal",
        reason: "litigation hold",
        createdByUserId: "actor-1",
      });

      expect(holds.create).toHaveBeenCalledOnce();
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "retention_hold_created",
          actorUserId: "actor-1",
          entityType: "retention_hold",
          action: "create",
        }),
      );
      expect(result.status).toBe("active");
    });

    it("rejects an entity-scoped hold missing resourceType/resourceId", async () => {
      await expect(
        service.createHold({
          scope: "entity",
          reasonCategory: "legal",
          reason: "x",
          createdByUserId: "actor-1",
        }),
      ).rejects.toThrow(/requires both resourceType and resourceId/);
      expect(holds.create).not.toHaveBeenCalled();
    });

    it("rejects a category-scoped hold missing categoryKey", async () => {
      await expect(
        service.createHold({
          scope: "category",
          reasonCategory: "legal",
          reason: "x",
          createdByUserId: "actor-1",
        }),
      ).rejects.toThrow(/requires categoryKey/);
      expect(holds.create).not.toHaveBeenCalled();
    });

    it("rejects an entity-scoped hold that also carries a categoryKey", async () => {
      await expect(
        service.createHold({
          scope: "entity",
          resourceType: "jobs",
          resourceId: "job-1",
          categoryKey: "job-failed-120d",
          reasonCategory: "legal",
          reason: "x",
          createdByUserId: "actor-1",
        }),
      ).rejects.toThrow(/must not also carry a categoryKey/);
      expect(holds.create).not.toHaveBeenCalled();
    });

    it("rejects a category-scoped hold that also carries resourceType/resourceId", async () => {
      await expect(
        service.createHold({
          scope: "category",
          categoryKey: "job-failed-120d",
          resourceType: "jobs",
          resourceId: "job-1",
          reasonCategory: "legal",
          reason: "x",
          createdByUserId: "actor-1",
        }),
      ).rejects.toThrow(/must not also carry resourceType\/resourceId/);
      expect(holds.create).not.toHaveBeenCalled();
    });
  });

  describe("releaseHold", () => {
    it("releases an active hold and records an audit event", async () => {
      holds.findById.mockResolvedValue(activeHold());
      holds.release.mockResolvedValue(activeHold({ status: "released" }));

      const result = await service.releaseHold("hold-1", {
        releaseReason: "investigation concluded",
        releasedByUserId: "actor-2",
      });

      expect(holds.release).toHaveBeenCalledWith("hold-1", {
        releaseReason: "investigation concluded",
        releasedByUserId: "actor-2",
      });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "retention_hold_released",
          actorUserId: "actor-2",
          reason: "investigation concluded",
        }),
      );
      expect(result.status).toBe("released");
    });

    it("rejects releasing without a release reason — never silently released", async () => {
      holds.findById.mockResolvedValue(activeHold());
      await expect(
        service.releaseHold("hold-1", { releaseReason: "   ", releasedByUserId: "actor-2" }),
      ).rejects.toThrow(/releaseReason is required/);
      expect(holds.release).not.toHaveBeenCalled();
    });

    it("rejects releasing a hold that doesn't exist", async () => {
      holds.findById.mockResolvedValue(null);
      await expect(
        service.releaseHold("hold-1", { releaseReason: "x", releasedByUserId: "actor-2" }),
      ).rejects.toThrow(/not found/);
    });

    it("rejects releasing a hold that is already released", async () => {
      holds.findById.mockResolvedValue(activeHold({ status: "released" }));
      await expect(
        service.releaseHold("hold-1", { releaseReason: "x", releasedByUserId: "actor-2" }),
      ).rejects.toThrow(/already released/);
      expect(holds.release).not.toHaveBeenCalled();
    });

    it("rejects with a conflict, not an unhandled error, when a concurrent release already won the same hold", async () => {
      holds.findById.mockResolvedValue(activeHold());
      holds.release.mockResolvedValue(null);

      await expect(
        service.releaseHold("hold-1", { releaseReason: "x", releasedByUserId: "actor-2" }),
      ).rejects.toThrow(/already released by a concurrent request/);
    });
  });
});
