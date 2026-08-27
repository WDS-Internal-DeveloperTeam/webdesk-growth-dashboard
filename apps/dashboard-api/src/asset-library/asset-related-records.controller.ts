import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AssetRelatedRecordEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createAssetRelatedRecordSchema,
  updateAssetRelatedRecordSchema,
  type CreateAssetRelatedRecordDto,
  type UpdateAssetRelatedRecordDto,
} from "./asset-library.dto.js";
import { ASSET_LIBRARY_MODULE_KEY } from "./asset-library.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AssetRelatedRecordsService } from "./asset-related-records.service.js";

type AssetRelatedRecordRequest = AuthenticatedRequest & RequestWithCorrelationId;

/**
 * Spec §12's "related records" (D3) — a sub-resource of one asset, so every route is nested under
 * `:assetId` and the service/repository re-scope every read/write by `(id, assetId)`.
 *
 * No confidential-field redaction here, deliberately: a relationship row carries only
 * `(moduleKey, recordId, note)`, none of which are among the two fields D2 classifies as
 * confidential on a restricted asset (`fileReference`, `consentReference`). Knowing that an asset
 * is linked to some record is not itself the private thing — the asset's file location is.
 *
 * Every `@RequirePermission` is on the individual method, never at class level — `PermissionGuard`
 * only reads `context.getHandler()` (a deliberate fail-closed design), so a class-level decorator
 * would silently 500 every route, the exact bug Service Library's own dimensions controller
 * shipped with once and had to fix.
 */
@ApiTags("asset-library")
@Controller("asset-library/assets/:assetId/related-records")
@UseGuards(SessionGuard)
export class AssetRelatedRecordsController {
  constructor(private readonly relatedRecords: AssetRelatedRecordsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(ASSET_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "List the records this asset is related to" })
  async list(
    @Param("assetId", new ParseUUIDPipe()) assetId: string,
    @Req() req: AssetRelatedRecordRequest,
  ): Promise<ApiSuccessResponse<readonly AssetRelatedRecordEntity[]>> {
    const data = await this.relatedRecords.listByAsset(assetId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(ASSET_LIBRARY_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Link this asset to a record in another module" })
  async create(
    @Param("assetId", new ParseUUIDPipe()) assetId: string,
    @Body(new ZodValidationPipe(createAssetRelatedRecordSchema))
    body: CreateAssetRelatedRecordDto,
    @Req() req: AssetRelatedRecordRequest,
  ): Promise<ApiSuccessResponse<AssetRelatedRecordEntity>> {
    const data = await this.relatedRecords.create(assetId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(ASSET_LIBRARY_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Edit a relationship's note (moduleKey/recordId are immutable)" })
  async update(
    @Param("assetId", new ParseUUIDPipe()) assetId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateAssetRelatedRecordSchema))
    body: UpdateAssetRelatedRecordDto,
    @Req() req: AssetRelatedRecordRequest,
  ): Promise<ApiSuccessResponse<AssetRelatedRecordEntity>> {
    const data = await this.relatedRecords.update(id, assetId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/delete")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(ASSET_LIBRARY_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Unlink this asset from a record (the link row is hard-deleted)" })
  async remove(
    @Param("assetId", new ParseUUIDPipe()) assetId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: AssetRelatedRecordRequest,
  ): Promise<ApiSuccessResponse<{ readonly removed: true }>> {
    await this.relatedRecords.remove(id, assetId, req.authUser!.id);
    return {
      success: true,
      data: { removed: true },
      correlationId: req.correlationId ?? "unknown",
    };
  }
}
