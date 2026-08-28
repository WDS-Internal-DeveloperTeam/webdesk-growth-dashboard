import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AssetEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import { redactConfidentialFields } from "../authz/confidential-field.util.js";
import {
  changeAssetApprovalStatusSchema,
  createAssetSchema,
  listAssetsQuerySchema,
  updateAssetSchema,
  type ChangeAssetApprovalStatusDto,
  type CreateAssetDto,
  type ListAssetsQueryDto,
  type UpdateAssetDto,
} from "./asset-library.dto.js";
import { ASSET_LIBRARY_MODULE_KEY } from "./asset-library.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AssetsService } from "./assets.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";

type AssetRequest = AuthenticatedRequest & RequestWithCorrelationId;

/**
 * The two fields redacted on a `restricted` asset for a caller lacking `view_confidential` (D2).
 *
 * `fileReference` is the actual location of a private asset — the single thing the roadmap's
 * "Private assets remain private until approved" sentence is most directly about.
 * `consentReference` is consent evidence, which routinely names real people.
 *
 * Deliberately conservative and name-driven: `title`, `licence`, `altTextGuidance`, and the
 * dimension fields all read as ordinary cataloguing metadata the spec never flags as restricted,
 * so they stay visible — the same selection discipline Service Library's own single-field
 * `internalDescription` choice used (a security-review finding on `module-service-library`).
 *
 * Unlike Brand Library, this module HAS such a mechanism because its own seeded
 * `module_registry.confidentiality_level` is a real "record-level" value, not `null`.
 */
const CONFIDENTIAL_RESTRICTED_FIELDS: readonly (keyof AssetEntity)[] = [
  "fileReference",
  "consentReference",
];

function redactIfRestricted<T extends AssetEntity>(asset: T, canViewConfidential: boolean): T {
  if (canViewConfidential || asset.visibility !== "restricted") {
    return asset;
  }
  return redactConfidentialFields(
    asset as unknown as Record<string, unknown>,
    CONFIDENTIAL_RESTRICTED_FIELDS,
    false,
  ) as unknown as T;
}

/** `redactConfidentialFieldsFromList()` applies uniformly to every list entry via one shared
 *  boolean — unusable directly here since only `restricted` assets in a mixed-visibility list
 *  should ever be redacted, so each record is checked individually. Mirrors
 *  `ServicesController`'s/`BusinessKnowledgeRecordsController`'s own identical helper. */
function redactRestrictedAssets<T extends AssetEntity>(
  assets: readonly T[],
  canViewConfidential: boolean,
): readonly T[] {
  if (canViewConfidential) {
    return assets;
  }
  return assets.map((asset) => redactIfRestricted(asset, canViewConfidential));
}

@ApiTags("asset-library")
@Controller("asset-library/assets")
@UseGuards(SessionGuard)
export class AssetsController {
  constructor(
    private readonly assets: AssetsService,
    private readonly authorizationService: AuthorizationService,
  ) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(ASSET_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "List assets, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listAssetsQuerySchema)) query: ListAssetsQueryDto,
    @Req() req: AssetRequest,
  ): Promise<ApiSuccessResponse<readonly AssetEntity[]>> {
    const [assets, canViewConfidential] = await Promise.all([
      this.assets.list(query),
      this.authorizationService.canViewConfidential(req.authUser!.id, ASSET_LIBRARY_MODULE_KEY),
    ]);
    const data = redactRestrictedAssets(assets, canViewConfidential);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(ASSET_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one asset" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: AssetRequest,
  ): Promise<ApiSuccessResponse<AssetEntity>> {
    const [asset, canViewConfidential] = await Promise.all([
      this.assets.findById(id),
      this.authorizationService.canViewConfidential(req.authUser!.id, ASSET_LIBRARY_MODULE_KEY),
    ]);
    const data = redactIfRestricted(asset, canViewConfidential);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(ASSET_LIBRARY_MODULE_KEY, "create")
  @ApiOperation({
    summary: "Create an asset (always starts draft, unpublished, scanStatus not_configured)",
  })
  async create(
    @Body(new ZodValidationPipe(createAssetSchema)) body: CreateAssetDto,
    @Req() req: AssetRequest,
  ): Promise<ApiSuccessResponse<AssetEntity>> {
    const created = await this.assets.create(body, req.authUser!.id);
    // Redacted on the way back out too: a caller may create a `restricted` asset without holding
    // `view_confidential`, and the response must not then echo the very fields a subsequent GET
    // would withhold — mirrors ServicesController.create()'s own identical treatment.
    const canViewConfidential = await this.authorizationService.canViewConfidential(
      req.authUser!.id,
      ASSET_LIBRARY_MODULE_KEY,
    );
    const data = redactIfRestricted(created, canViewConfidential);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(ASSET_LIBRARY_MODULE_KEY, "edit")
  @ApiOperation({
    summary:
      "Edit an asset's content fields (increments version, never touches " +
      "approvalStatus/scanStatus/isPublished/publishedAt)",
  })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateAssetSchema)) body: UpdateAssetDto,
    @Req() req: AssetRequest,
  ): Promise<ApiSuccessResponse<AssetEntity>> {
    const updated = await this.assets.update(id, body, req.authUser!.id);
    const canViewConfidential = await this.authorizationService.canViewConfidential(
      req.authUser!.id,
      ASSET_LIBRARY_MODULE_KEY,
    );
    const data = redactIfRestricted(updated, canViewConfidential);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve) and is checked dynamically inside the service itself, the same layered
  // pattern brand-library.controller.ts's own status route already established. PermissionGuard
  // still runs (via @UseGuards below) checking only module `view`, so a caller with no access to
  // this module at all is still rejected at the route.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(ASSET_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition an asset's approval status" })
  async changeStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeAssetApprovalStatusSchema))
    body: ChangeAssetApprovalStatusDto,
    @Req() req: AssetRequest,
  ): Promise<ApiSuccessResponse<AssetEntity>> {
    const updated = await this.assets.changeApprovalStatus(
      id,
      body.approvalStatus,
      req.authUser!.id,
    );
    const canViewConfidential = await this.authorizationService.canViewConfidential(
      req.authUser!.id,
      ASSET_LIBRARY_MODULE_KEY,
    );
    const data = redactIfRestricted(updated, canViewConfidential);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/publish")
  @HttpCode(HttpStatus.OK)
  // Same layered pattern as the status route above — the real gate is the "publish" action,
  // checked dynamically inside the service (which also enforces the approvalStatus === "approved"
  // business rule) rather than a static @RequirePermission("publish") here, so the service's own
  // 400/404/409 outcomes are reachable before/instead of a blanket 403.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(ASSET_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "Publish an approved asset" })
  async publish(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: AssetRequest,
  ): Promise<ApiSuccessResponse<AssetEntity>> {
    const published = await this.assets.publish(id, req.authUser!.id);
    const canViewConfidential = await this.authorizationService.canViewConfidential(
      req.authUser!.id,
      ASSET_LIBRARY_MODULE_KEY,
    );
    const data = redactIfRestricted(published, canViewConfidential);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/unpublish")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(ASSET_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "Unpublish an asset (allowed regardless of approvalStatus)" })
  async unpublish(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: AssetRequest,
  ): Promise<ApiSuccessResponse<AssetEntity>> {
    const unpublished = await this.assets.unpublish(id, req.authUser!.id);
    const canViewConfidential = await this.authorizationService.canViewConfidential(
      req.authUser!.id,
      ASSET_LIBRARY_MODULE_KEY,
    );
    const data = redactIfRestricted(unpublished, canViewConfidential);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
