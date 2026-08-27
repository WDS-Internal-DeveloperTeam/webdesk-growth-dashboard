import type {
  AssetEntity,
  AssetRelatedRecordEntity,
  AssetRelatedRecordRepository,
  AssetRepository,
} from "@webdesk/database";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import { AssetRelatedRecordsService } from "./asset-related-records.service.js";

const NOW = new Date("2026-08-27T00:00:00.000Z");
const ASSET_ID = "11111111-1111-4111-8111-111111111111";
const RECORD_ID = "22222222-2222-4222-8222-222222222222";

function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function asset(): AssetEntity {
  return {
    id: ASSET_ID,
    publicId: "ASSET-HERO-001",
    title: "Homepage hero image",
    description: null,
    fileReference: null,
    mimeType: null,
    fileSizeBytes: null,
    checksum: null,
    widthPx: null,
    heightPx: null,
    durationSeconds: null,
    licence: null,
    licenceHolder: null,
    consentReference: null,
    altTextGuidance: null,
    visibility: "internal",
    retentionNote: null,
    scanStatus: "not_configured",
    approvalStatus: "draft",
    version: 1,
    isPublished: false,
    publishedAt: null,
    createdBy: "actor-1",
    updatedBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

function relatedRecord(
  overrides: Partial<AssetRelatedRecordEntity> = {},
): AssetRelatedRecordEntity {
  return {
    id: "link-1",
    assetId: ASSET_ID,
    moduleKey: "page_inventory",
    recordId: RECORD_ID,
    note: null,
    createdBy: "actor-1",
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("AssetRelatedRecordsService", () => {
  let relatedRecords: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    listByAsset: ReturnType<typeof vi.fn>;
    listByTarget: ReturnType<typeof vi.fn>;
    findByTargetForAsset: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let assets: { findById: ReturnType<typeof vi.fn> };
  let authorizationService: { isValidModuleKey: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: AssetRelatedRecordsService;

  beforeEach(() => {
    relatedRecords = {
      create: vi.fn(),
      findById: vi.fn(),
      listByAsset: vi.fn(),
      listByTarget: vi.fn(),
      findByTargetForAsset: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    assets = { findById: vi.fn().mockResolvedValue(asset()) };
    authorizationService = { isValidModuleKey: vi.fn().mockResolvedValue(true) };
    auditService = { record: vi.fn() };
    svc = new AssetRelatedRecordsService(
      relatedRecords as unknown as AssetRelatedRecordRepository,
      assets as unknown as AssetRepository,
      authorizationService as unknown as AuthorizationService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("links an asset to a record in another module", async () => {
      relatedRecords.findByTargetForAsset.mockResolvedValue(null);
      relatedRecords.create.mockResolvedValue(relatedRecord());

      const result = await svc.create(
        ASSET_ID,
        { moduleKey: "page_inventory", recordId: RECORD_ID },
        "actor-1",
      );

      expect(result).toEqual(relatedRecord());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "asset_related_record" }),
      );
    });

    it("validates moduleKey against the REAL module registry, not a hardcoded list", async () => {
      relatedRecords.findByTargetForAsset.mockResolvedValue(null);
      authorizationService.isValidModuleKey.mockResolvedValue(false);

      await expect(
        svc.create(ASSET_ID, { moduleKey: "not_a_real_module", recordId: RECORD_ID }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(authorizationService.isValidModuleKey).toHaveBeenCalledWith("not_a_real_module");
      expect(relatedRecords.create).not.toHaveBeenCalled();
    });

    it("reports a well-formed but nonexistent assetId as a 404, not a raw FK 500", async () => {
      assets.findById.mockResolvedValue(null);

      await expect(
        svc.create(ASSET_ID, { moduleKey: "page_inventory", recordId: RECORD_ID }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(relatedRecords.create).not.toHaveBeenCalled();
    });

    it("rejects linking the same target to the same asset twice", async () => {
      relatedRecords.findByTargetForAsset.mockResolvedValue(relatedRecord());

      await expect(
        svc.create(ASSET_ID, { moduleKey: "page_inventory", recordId: RECORD_ID }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(relatedRecords.create).not.toHaveBeenCalled();
    });

    it("translates a concurrent duplicate link into a clean 400, not a raw 500", async () => {
      relatedRecords.findByTargetForAsset.mockResolvedValue(null);
      relatedRecords.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create(ASSET_ID, { moduleKey: "page_inventory", recordId: RECORD_ID }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("re-throws a non-uniqueness error from create() unchanged", async () => {
      relatedRecords.findByTargetForAsset.mockResolvedValue(null);
      const dbError = new Error("connection reset");
      relatedRecords.create.mockRejectedValue(dbError);

      await expect(
        svc.create(ASSET_ID, { moduleKey: "page_inventory", recordId: RECORD_ID }, "actor-1"),
      ).rejects.toBe(dbError);
    });
  });

  describe("listByAsset", () => {
    it("reports an unknown asset as a 404 rather than an empty list", async () => {
      assets.findById.mockResolvedValue(null);

      await expect(svc.listByAsset(ASSET_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    it("scopes the write by (id, assetId) — real IDOR prevention", async () => {
      relatedRecords.update.mockResolvedValue(relatedRecord({ note: "Used in the hero band" }));

      await svc.update("link-1", ASSET_ID, { note: "Used in the hero band" }, "actor-1");

      expect(relatedRecords.update).toHaveBeenCalledWith("link-1", ASSET_ID, {
        note: "Used in the hero band",
      });
    });

    it("404s when the link does not belong to this asset", async () => {
      // The repository's (id, assetId)-scoped UPDATE affects 0 rows for another asset's link.
      relatedRecords.update.mockResolvedValue(null);

      await expect(
        svc.update("link-of-another-asset", ASSET_ID, { note: "x" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("hard-deletes the link and audits the removal", async () => {
      relatedRecords.findById.mockResolvedValue(relatedRecord());
      relatedRecords.remove.mockResolvedValue(true);

      await svc.remove("link-1", ASSET_ID, "actor-1");

      expect(relatedRecords.remove).toHaveBeenCalledWith("link-1", ASSET_ID);
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "delete",
          // The linkage survives as audit history even though the row is gone.
          beforeState: expect.objectContaining({ moduleKey: "page_inventory" }),
        }),
      );
    });

    it("404s when the link does not belong to this asset", async () => {
      relatedRecords.findById.mockResolvedValue(null);

      await expect(svc.remove("link-1", ASSET_ID, "actor-1")).rejects.toThrow(NotFoundException);
      expect(relatedRecords.remove).not.toHaveBeenCalled();
    });

    it("reports a concurrent removal honestly as a 404 rather than a false success", async () => {
      relatedRecords.findById.mockResolvedValue(relatedRecord());
      relatedRecords.remove.mockResolvedValue(false);

      await expect(svc.remove("link-1", ASSET_ID, "actor-1")).rejects.toThrow(NotFoundException);
      expect(auditService.record).not.toHaveBeenCalled();
    });
  });
});
