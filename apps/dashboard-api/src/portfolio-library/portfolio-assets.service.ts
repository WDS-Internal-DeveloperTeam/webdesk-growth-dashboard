import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  PortfolioAssetEntity,
  PortfolioAssetRepository,
  PortfolioRecordRepository,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import {
  PORTFOLIO_ASSET_REPOSITORY,
  PORTFOLIO_RECORD_REPOSITORY,
} from "./portfolio-library.constants.js";
import type { CreatePortfolioAssetDto, UpdatePortfolioAssetDto } from "./portfolio-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AssetsService } from "../asset-library/assets.service.js";

/**
 * Portfolio-record-asset (screenshots) join CRUD, scoped to a parent portfolio record — mirrors
 * `CaseStudyAssetsService`'s own shape exactly (D2), the closest existing precedent for this
 * exact join pattern. Not independently governed by the parent record's status workflow —
 * adding/editing/removing a linked asset is an `edit`-level action, same tier as editing the
 * record's own content fields, checked at the controller/route level (no dynamic per-transition
 * check needed here, unlike `PortfolioRecordsService.changeApprovalStatus()`).
 */
@Injectable()
export class PortfolioAssetsService {
  constructor(
    @Inject(PORTFOLIO_ASSET_REPOSITORY)
    private readonly portfolioAssets: PortfolioAssetRepository,
    @Inject(PORTFOLIO_RECORD_REPOSITORY)
    private readonly portfolioRecords: PortfolioRecordRepository,
    private readonly assetsService: AssetsService,
    private readonly auditService: AuditService,
  ) {}

  /** `portfolio_assets.portfolio_record_id` is FK-constrained (migration `00095`), but a
   *  well-formed, nonexistent `portfolioRecordId` was previously only caught at the database layer
   *  — surfacing as a raw, unhandled 500 instead of a clean 404 (mirrors
   *  `CaseStudyAssetsService.create()`'s own identical guard). `assetId` has no DB-level FK at all
   *  (D2) — existence-validated here at the app layer via `AssetsService.existingAssetIds()`. */
  async create(
    portfolioRecordId: string,
    input: CreatePortfolioAssetDto,
    actorUserId: string,
  ): Promise<PortfolioAssetEntity> {
    // Two independent reads against unrelated tables, neither consuming the other's result — run
    // concurrently, mirroring CaseStudyAssetsService.create()'s own established pattern.
    const [portfolioRecord, foundAssetIds] = await Promise.all([
      this.portfolioRecords.findById(portfolioRecordId),
      this.assetsService.existingAssetIds([input.assetId]),
    ]);
    if (!portfolioRecord) {
      throw new NotFoundException(`Portfolio record not found: ${portfolioRecordId}`);
    }
    if (!foundAssetIds.has(input.assetId)) {
      throw new BadRequestException(`assetId not found: ${input.assetId}`);
    }

    let created: PortfolioAssetEntity;
    try {
      created = await this.portfolioAssets.create({
        portfolioRecordId,
        assetId: input.assetId,
        role: input.role,
        caption: input.caption,
      });
    } catch (error) {
      // The (portfolioRecordId, assetId) unique index catches a race/duplicate submission —
      // surfaced as a clean 400 rather than a raw 500, mirroring
      // PortfolioRecordsService.create()'s own publicId-uniqueness catch.
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(
          `Asset ${input.assetId} is already linked to portfolio record ${portfolioRecordId}`,
        );
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "portfolio_asset",
      entityId: created.id,
      action: "create",
      afterState: { portfolioRecordId, assetId: created.assetId, role: created.role },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async findById(id: string): Promise<PortfolioAssetEntity> {
    const asset = await this.portfolioAssets.findById(id);
    if (!asset) {
      throw new NotFoundException(`Portfolio asset not found: ${id}`);
    }
    return asset;
  }

  async listByPortfolioRecord(portfolioRecordId: string): Promise<readonly PortfolioAssetEntity[]> {
    return this.portfolioAssets.listByPortfolioRecord(portfolioRecordId);
  }

  /** `portfolioRecordId`-scoped (IDOR prevention) — a join row from a different portfolio record,
   *  accessed via this record's own route, is treated as not found rather than silently updated. */
  async update(
    id: string,
    portfolioRecordId: string,
    patch: UpdatePortfolioAssetDto,
    actorUserId: string,
  ): Promise<PortfolioAssetEntity> {
    const updated = await this.portfolioAssets.update(id, portfolioRecordId, patch);
    if (!updated) {
      throw new NotFoundException(`Portfolio asset not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "portfolio_asset",
      entityId: id,
      action: "update",
      afterState: { portfolioRecordId, ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  /** `portfolioRecordId`-scoped (IDOR prevention), same as `update()` — the scoped `remove()` call
   *  below is the sole enforcement point; the `findById()` pre-fetch exists only to populate the
   *  audit `beforeState`, not to re-check ownership (that would be redundant with the scoped
   *  delete's own compound `WHERE` clause). */
  async remove(id: string, portfolioRecordId: string, actorUserId: string): Promise<void> {
    const asset = await this.findById(id);

    const removed = await this.portfolioAssets.remove(id, portfolioRecordId);
    if (!removed) {
      throw new NotFoundException(`Portfolio asset not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "portfolio_asset",
      entityId: id,
      action: "delete",
      beforeState: { portfolioRecordId, assetId: asset.assetId, role: asset.role },
      retentionCategory: "audit-7y",
    });
  }
}
