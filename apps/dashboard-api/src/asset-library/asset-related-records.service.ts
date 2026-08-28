import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AssetRelatedRecordEntity,
  AssetRelatedRecordRepository,
  AssetRepository,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import { ASSET_RELATED_RECORD_REPOSITORY, ASSET_REPOSITORY } from "./asset-library.constants.js";
import type {
  CreateAssetRelatedRecordDto,
  UpdateAssetRelatedRecordDto,
} from "./asset-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";

/**
 * Spec §12's "related records" (D3) — a genuine sub-resource of one asset, carrying a polymorphic
 * `(moduleKey, recordId)` reference to a record in any other module.
 *
 * Every method is scoped by `assetId`, and the repository re-scopes every read/write by
 * `(id, assetId)` at the database level — real IDOR prevention at both layers, mirroring
 * `ClaimSourcesService`/`ClaimSourceRepository`'s own identical two-layer treatment.
 */
@Injectable()
export class AssetRelatedRecordsService {
  constructor(
    @Inject(ASSET_RELATED_RECORD_REPOSITORY)
    private readonly relatedRecords: AssetRelatedRecordRepository,
    @Inject(ASSET_REPOSITORY)
    private readonly assets: AssetRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  /** A well-formed but nonexistent `assetId` must surface as a clean 404, not a raw 500 from a
   *  foreign-key violation on INSERT — the exact gap Proof and Claims Library's own code review
   *  found in `ClaimSourcesService.create()` and fixed the same way. */
  private async assertAssetExists(assetId: string): Promise<void> {
    const asset = await this.assets.findById(assetId);
    if (!asset) {
      throw new NotFoundException(`Asset not found: ${assetId}`);
    }
  }

  async listByAsset(assetId: string): Promise<readonly AssetRelatedRecordEntity[]> {
    await this.assertAssetExists(assetId);
    return this.relatedRecords.listByAsset(assetId);
  }

  async create(
    assetId: string,
    input: CreateAssetRelatedRecordDto,
    actorUserId: string,
  ): Promise<AssetRelatedRecordEntity> {
    // Both checks are genuinely independent — neither's result feeds the other — so they run
    // concurrently rather than sequentially, the avoidable-latency bug class this project's own
    // reviews have caught repeatedly (Persona Library, Keyword & Entity Library).
    const [, isValidModule] = await Promise.all([
      this.assertAssetExists(assetId),
      // Validated against the REAL module registry (D3), not a hardcoded list — an unrecognized
      // key would otherwise create a relationship pointing at nothing. Mirrors
      // `ReviewsService.create()`'s own identical `isValidModuleKey()` guard, which is also why
      // this goes through `AuthorizationService`'s narrow delegating method rather than importing
      // `ModuleRegistryRepository` across the module boundary.
      this.authorizationService.isValidModuleKey(input.moduleKey),
    ]);
    if (!isValidModule) {
      throw new BadRequestException(
        `moduleKey does not resolve to a real module: ${input.moduleKey}`,
      );
    }

    const duplicate = await this.relatedRecords.findByTargetForAsset(
      assetId,
      input.moduleKey,
      input.recordId,
    );
    if (duplicate) {
      throw new BadRequestException(
        `Asset ${assetId} is already linked to ${input.moduleKey}/${input.recordId}`,
      );
    }

    let created: AssetRelatedRecordEntity;
    try {
      created = await this.relatedRecords.create({
        assetId,
        moduleKey: input.moduleKey,
        recordId: input.recordId,
        note: input.note,
        createdBy: actorUserId,
      });
    } catch (error) {
      // The duplicate check above is TOCTOU — the real unique index
      // (`asset_related_records_asset_target_unique`) is what actually enforces this under
      // concurrency; without this catch the race loser would surface as a raw 500 instead of the
      // same clean 400 the non-racing caller already gets.
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(
          `Asset ${assetId} is already linked to ${input.moduleKey}/${input.recordId}`,
        );
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "asset_related_record",
      entityId: created.id,
      action: "create",
      afterState: {
        assetId,
        moduleKey: created.moduleKey,
        recordId: created.recordId,
      },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async update(
    id: string,
    assetId: string,
    patch: UpdateAssetRelatedRecordDto,
    actorUserId: string,
  ): Promise<AssetRelatedRecordEntity> {
    // Scoped by `(id, assetId)` in the same UPDATE — a caller authorized on one asset can never
    // mutate another asset's relationship row by guessing an id.
    const updated = await this.relatedRecords.update(id, assetId, patch);
    if (!updated) {
      throw new NotFoundException(`Related record not found on asset ${assetId}: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "asset_related_record",
      entityId: id,
      action: "update",
      afterState: { assetId, ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  /** A relationship row is pure linkage metadata carrying no approval history of its own, so
   *  unlike an asset itself (retired via `archived`, ADR-0016) it is genuinely hard-deletable —
   *  matching `ClaimSourcesService.remove()`'s own identical treatment of the same kind of row.
   *  The delete is audited, so the linkage's removal is still recoverable as history. */
  async remove(id: string, assetId: string, actorUserId: string): Promise<void> {
    const existing = await this.relatedRecords.findById(id, assetId);
    if (!existing) {
      throw new NotFoundException(`Related record not found on asset ${assetId}: ${id}`);
    }

    const removed = await this.relatedRecords.remove(id, assetId);
    if (!removed) {
      // Concurrently removed between the read above and this delete — the caller's intent (that
      // the link no longer exist) is already satisfied, but reporting it honestly as a 404 rather
      // than a success keeps the response truthful about what THIS call did.
      throw new NotFoundException(`Related record not found on asset ${assetId}: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "asset_related_record",
      entityId: id,
      action: "delete",
      beforeState: {
        assetId,
        moduleKey: existing.moduleKey,
        recordId: existing.recordId,
      },
      retentionCategory: "audit-7y",
    });
  }
}
