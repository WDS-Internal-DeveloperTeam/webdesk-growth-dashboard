import type {
  PortfolioAssetEntity,
  PortfolioAssetRepository,
  PortfolioRecordEntity,
  PortfolioRecordRepository,
} from "@webdesk/database";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AssetsService } from "../asset-library/assets.service.js";
import { PortfolioAssetsService } from "./portfolio-assets.service.js";

const NOW = new Date("2026-09-01T00:00:00.000Z");
const FAKE_ASSET_ID = "66666666-6666-4666-8666-666666666666";

function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function portfolioAsset(overrides: Partial<PortfolioAssetEntity> = {}): PortfolioAssetEntity {
  return {
    id: "pa-1",
    portfolioRecordId: "record-1",
    assetId: FAKE_ASSET_ID,
    role: "hero_screenshot",
    caption: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function portfolioRecordStub(
  overrides: Partial<PortfolioRecordEntity> = {},
): PortfolioRecordEntity {
  return { id: "record-1", ...overrides } as PortfolioRecordEntity;
}

describe("PortfolioAssetsService", () => {
  let portfolioAssets: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    listByPortfolioRecord: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let portfolioRecords: { findById: ReturnType<typeof vi.fn> };
  let assetsService: { existingAssetIds: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: PortfolioAssetsService;

  beforeEach(() => {
    portfolioAssets = {
      create: vi.fn(),
      findById: vi.fn(),
      listByPortfolioRecord: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    portfolioRecords = { findById: vi.fn() };
    assetsService = { existingAssetIds: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new PortfolioAssetsService(
      portfolioAssets as unknown as PortfolioAssetRepository,
      portfolioRecords as unknown as PortfolioRecordRepository,
      assetsService as unknown as AssetsService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("404s when the parent portfolio record doesn't exist, instead of a raw 500 from the FK", async () => {
      portfolioRecords.findById.mockResolvedValue(null);

      await expect(
        svc.create("missing-record", { assetId: FAKE_ASSET_ID, role: "logo" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(portfolioAssets.create).not.toHaveBeenCalled();
    });

    it("rejects an assetId that doesn't resolve to a real asset (D2, no DB-level FK)", async () => {
      portfolioRecords.findById.mockResolvedValue(portfolioRecordStub());
      assetsService.existingAssetIds.mockResolvedValue(new Set());

      await expect(
        svc.create("record-1", { assetId: FAKE_ASSET_ID, role: "logo" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(portfolioAssets.create).not.toHaveBeenCalled();
    });

    it("links a real asset (screenshot) to the portfolio record", async () => {
      portfolioRecords.findById.mockResolvedValue(portfolioRecordStub());
      assetsService.existingAssetIds.mockResolvedValue(new Set([FAKE_ASSET_ID]));
      portfolioAssets.create.mockResolvedValue(portfolioAsset());

      const result = await svc.create(
        "record-1",
        { assetId: FAKE_ASSET_ID, role: "hero_screenshot" },
        "actor-1",
      );

      expect(result).toEqual(portfolioAsset());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "portfolio_asset" }),
      );
    });

    it("translates a duplicate (portfolioRecordId, assetId) link into a clean 400", async () => {
      portfolioRecords.findById.mockResolvedValue(portfolioRecordStub());
      assetsService.existingAssetIds.mockResolvedValue(new Set([FAKE_ASSET_ID]));
      portfolioAssets.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create("record-1", { assetId: FAKE_ASSET_ID, role: "logo" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("update / remove (IDOR scoping)", () => {
    it("404s update() when portfolioAssets.update() reports no match (wrong portfolioRecordId)", async () => {
      portfolioAssets.update.mockResolvedValue(null);

      await expect(svc.update("pa-1", "wrong-record", { role: "logo" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("404s remove() when the asset belongs to a different portfolio record", async () => {
      // findById() itself is unscoped — the real IDOR enforcement is the scoped remove() call
      // below, matching how the repository's own compound WHERE (id, portfolioRecordId) behaves
      // against a mismatched record (no rows affected, returns false).
      portfolioAssets.findById.mockResolvedValue(
        portfolioAsset({ portfolioRecordId: "other-record" }),
      );
      portfolioAssets.remove.mockResolvedValue(false);

      await expect(svc.remove("pa-1", "record-1", "actor-1")).rejects.toThrow(NotFoundException);
      expect(portfolioAssets.remove).toHaveBeenCalledWith("pa-1", "record-1");
    });

    it("removes a real link scoped correctly", async () => {
      portfolioAssets.findById.mockResolvedValue(portfolioAsset({ portfolioRecordId: "record-1" }));
      portfolioAssets.remove.mockResolvedValue(true);

      await svc.remove("pa-1", "record-1", "actor-1");

      expect(portfolioAssets.remove).toHaveBeenCalledWith("pa-1", "record-1");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "delete", entityType: "portfolio_asset" }),
      );
    });
  });
});
