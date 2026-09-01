import type {
  CaseStudyAssetEntity,
  CaseStudyAssetRepository,
  CaseStudyEntity,
  CaseStudyRepository,
} from "@webdesk/database";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AssetsService } from "../asset-library/assets.service.js";
import { CaseStudyAssetsService } from "./case-study-assets.service.js";

const NOW = new Date("2026-08-31T00:00:00.000Z");
const FAKE_ASSET_ID = "44444444-4444-4444-8444-444444444444";

function uniqueConstraintError(): Error {
  const error = new Error("Validation error");
  error.name = "SequelizeUniqueConstraintError";
  return error;
}

function caseStudyAsset(overrides: Partial<CaseStudyAssetEntity> = {}): CaseStudyAssetEntity {
  return {
    id: "csa-1",
    caseStudyId: "cs-1",
    assetId: FAKE_ASSET_ID,
    role: "hero_screenshot",
    caption: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function caseStudyStub(overrides: Partial<CaseStudyEntity> = {}): CaseStudyEntity {
  return { id: "cs-1", ...overrides } as CaseStudyEntity;
}

describe("CaseStudyAssetsService", () => {
  let caseStudyAssets: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    listByCaseStudy: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let caseStudies: { findById: ReturnType<typeof vi.fn> };
  let assetsService: { existingAssetIds: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: CaseStudyAssetsService;

  beforeEach(() => {
    caseStudyAssets = {
      create: vi.fn(),
      findById: vi.fn(),
      listByCaseStudy: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    };
    caseStudies = { findById: vi.fn() };
    assetsService = { existingAssetIds: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new CaseStudyAssetsService(
      caseStudyAssets as unknown as CaseStudyAssetRepository,
      caseStudies as unknown as CaseStudyRepository,
      assetsService as unknown as AssetsService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("404s when the parent case study doesn't exist, instead of a raw 500 from the FK", async () => {
      caseStudies.findById.mockResolvedValue(null);

      await expect(
        svc.create("missing-cs", { assetId: FAKE_ASSET_ID, role: "logo" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(caseStudyAssets.create).not.toHaveBeenCalled();
    });

    it("rejects an assetId that doesn't resolve to a real asset (D3, no DB-level FK)", async () => {
      caseStudies.findById.mockResolvedValue(caseStudyStub());
      assetsService.existingAssetIds.mockResolvedValue(new Set());

      await expect(
        svc.create("cs-1", { assetId: FAKE_ASSET_ID, role: "logo" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(caseStudyAssets.create).not.toHaveBeenCalled();
    });

    it("links a real asset to the case study", async () => {
      caseStudies.findById.mockResolvedValue(caseStudyStub());
      assetsService.existingAssetIds.mockResolvedValue(new Set([FAKE_ASSET_ID]));
      caseStudyAssets.create.mockResolvedValue(caseStudyAsset());

      const result = await svc.create(
        "cs-1",
        { assetId: FAKE_ASSET_ID, role: "hero_screenshot" },
        "actor-1",
      );

      expect(result).toEqual(caseStudyAsset());
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "case_study_asset" }),
      );
    });

    it("translates a duplicate (caseStudyId, assetId) link into a clean 400", async () => {
      caseStudies.findById.mockResolvedValue(caseStudyStub());
      assetsService.existingAssetIds.mockResolvedValue(new Set([FAKE_ASSET_ID]));
      caseStudyAssets.create.mockRejectedValue(uniqueConstraintError());

      await expect(
        svc.create("cs-1", { assetId: FAKE_ASSET_ID, role: "logo" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("update / remove (IDOR scoping)", () => {
    it("404s update() when caseStudyAssets.update() reports no match (wrong caseStudyId)", async () => {
      caseStudyAssets.update.mockResolvedValue(null);

      await expect(svc.update("csa-1", "wrong-cs", { role: "logo" }, "actor-1")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("404s remove() when the asset belongs to a different case study", async () => {
      caseStudyAssets.findById.mockResolvedValue(caseStudyAsset({ caseStudyId: "other-cs" }));

      await expect(svc.remove("csa-1", "cs-1", "actor-1")).rejects.toThrow(NotFoundException);
      expect(caseStudyAssets.remove).not.toHaveBeenCalled();
    });

    it("removes a real link scoped correctly", async () => {
      caseStudyAssets.findById.mockResolvedValue(caseStudyAsset({ caseStudyId: "cs-1" }));
      caseStudyAssets.remove.mockResolvedValue(true);

      await svc.remove("csa-1", "cs-1", "actor-1");

      expect(caseStudyAssets.remove).toHaveBeenCalledWith("csa-1", "cs-1");
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "delete", entityType: "case_study_asset" }),
      );
    });
  });
});
