import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CaseStudyAssetEntity,
  CaseStudyAssetRepository,
  CaseStudyRepository,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import {
  CASE_STUDY_ASSET_REPOSITORY,
  CASE_STUDY_REPOSITORY,
} from "./case-study-studio.constants.js";
import type { CreateCaseStudyAssetDto, UpdateCaseStudyAssetDto } from "./case-study-studio.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AssetsService } from "../asset-library/assets.service.js";

/**
 * Case-study-asset join CRUD, scoped to a parent case study — mirrors `ClaimSourcesService`'s own
 * shape (`apps/dashboard-api/src/proof-and-claims-library/claim-sources.service.ts`), the closest
 * existing precedent for a genuine sub-resource service in this codebase. Not independently
 * governed by the parent case study's status workflow — adding/editing/removing a linked asset is
 * an `edit`-level action, same tier as editing the case study's own content fields, checked at the
 * controller/route level (no dynamic per-transition check needed here, unlike
 * `CaseStudiesService.changeStatus()`).
 */
@Injectable()
export class CaseStudyAssetsService {
  constructor(
    @Inject(CASE_STUDY_ASSET_REPOSITORY) private readonly caseStudyAssets: CaseStudyAssetRepository,
    @Inject(CASE_STUDY_REPOSITORY) private readonly caseStudies: CaseStudyRepository,
    private readonly assetsService: AssetsService,
    private readonly auditService: AuditService,
  ) {}

  /** `case_study_assets.case_study_id` is FK-constrained (migration `00091`), but a well-formed,
   *  nonexistent `caseStudyId` was previously only caught at the database layer — surfacing as a
   *  raw, unhandled 500 instead of a clean 404 (mirrors `ClaimSourcesService.create()`'s own
   *  identical guard). `assetId` has no DB-level FK at all (D3) — existence-validated here at the
   *  app layer via `AssetsService.existingAssetIds()`. */
  async create(
    caseStudyId: string,
    input: CreateCaseStudyAssetDto,
    actorUserId: string,
  ): Promise<CaseStudyAssetEntity> {
    // Two independent reads against unrelated tables, neither consuming the other's result — run
    // concurrently (code-review finding — these previously ran as two sequential awaits).
    const [caseStudy, foundAssetIds] = await Promise.all([
      this.caseStudies.findById(caseStudyId),
      this.assetsService.existingAssetIds([input.assetId]),
    ]);
    if (!caseStudy) {
      throw new NotFoundException(`Case study not found: ${caseStudyId}`);
    }
    if (!foundAssetIds.has(input.assetId)) {
      throw new BadRequestException(`assetId not found: ${input.assetId}`);
    }

    let created: CaseStudyAssetEntity;
    try {
      created = await this.caseStudyAssets.create({
        caseStudyId,
        assetId: input.assetId,
        role: input.role,
        caption: input.caption,
      });
    } catch (error) {
      // The (caseStudyId, assetId) unique index catches a race/duplicate submission — surfaced as
      // a clean 400 rather than a raw 500, mirroring CaseStudiesService.create()'s own
      // publicId-uniqueness catch. Uses the shared `@webdesk/validation` helper (code-review
      // finding — this previously hand-rolled the check the helper already exists to replace).
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(
          `Asset ${input.assetId} is already linked to case study ${caseStudyId}`,
        );
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "case_study_asset",
      entityId: created.id,
      action: "create",
      afterState: { caseStudyId, assetId: created.assetId, role: created.role },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async findById(id: string): Promise<CaseStudyAssetEntity> {
    const asset = await this.caseStudyAssets.findById(id);
    if (!asset) {
      throw new NotFoundException(`Case study asset not found: ${id}`);
    }
    return asset;
  }

  async listByCaseStudy(caseStudyId: string): Promise<readonly CaseStudyAssetEntity[]> {
    return this.caseStudyAssets.listByCaseStudy(caseStudyId);
  }

  /** `caseStudyId`-scoped (IDOR prevention) — a join row from a different case study, accessed via
   *  this case study's own route, is treated as not found rather than silently updated. */
  async update(
    id: string,
    caseStudyId: string,
    patch: UpdateCaseStudyAssetDto,
    actorUserId: string,
  ): Promise<CaseStudyAssetEntity> {
    const updated = await this.caseStudyAssets.update(id, caseStudyId, patch);
    if (!updated) {
      throw new NotFoundException(`Case study asset not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "case_study_asset",
      entityId: id,
      action: "update",
      afterState: { caseStudyId, ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  /** `caseStudyId`-scoped (IDOR prevention), same as `update()`. */
  async remove(id: string, caseStudyId: string, actorUserId: string): Promise<void> {
    const asset = await this.findById(id);
    if (asset.caseStudyId !== caseStudyId) {
      throw new NotFoundException(`Case study asset not found: ${id}`);
    }

    const removed = await this.caseStudyAssets.remove(id, caseStudyId);
    if (!removed) {
      throw new NotFoundException(`Case study asset not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "case_study_asset",
      entityId: id,
      action: "delete",
      beforeState: { caseStudyId, assetId: asset.assetId, role: asset.role },
      retentionCategory: "audit-7y",
    });
  }
}
