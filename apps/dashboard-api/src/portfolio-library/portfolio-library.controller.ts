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
import type { PortfolioAssetEntity, PortfolioRecordEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changePortfolioApprovalStatusSchema,
  createPortfolioAssetSchema,
  createPortfolioRecordSchema,
  listPortfolioRecordsQuerySchema,
  updatePortfolioAssetSchema,
  updatePortfolioRecordSchema,
  type ChangePortfolioApprovalStatusDto,
  type CreatePortfolioAssetDto,
  type CreatePortfolioRecordDto,
  type ListPortfolioRecordsQueryDto,
  type UpdatePortfolioAssetDto,
  type UpdatePortfolioRecordDto,
} from "./portfolio-library.dto.js";
import { PORTFOLIO_LIBRARY_MODULE_KEY } from "./portfolio-library.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { PortfolioRecordsService } from "./portfolio-records.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { PortfolioAssetsService } from "./portfolio-assets.service.js";

type PortfolioLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("portfolio-library")
@Controller("portfolio-library/records")
@UseGuards(SessionGuard)
export class PortfolioLibraryController {
  constructor(private readonly portfolioRecords: PortfolioRecordsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(PORTFOLIO_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "List portfolio records, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listPortfolioRecordsQuerySchema))
    query: ListPortfolioRecordsQueryDto,
    @Req() req: PortfolioLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly PortfolioRecordEntity[]>> {
    const data = await this.portfolioRecords.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(PORTFOLIO_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one portfolio record" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: PortfolioLibraryRequest,
  ): Promise<ApiSuccessResponse<PortfolioRecordEntity>> {
    const data = await this.portfolioRecords.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(PORTFOLIO_LIBRARY_MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a portfolio record (always starts draft, unpublished)" })
  async create(
    @Body(new ZodValidationPipe(createPortfolioRecordSchema)) body: CreatePortfolioRecordDto,
    @Req() req: PortfolioLibraryRequest,
  ): Promise<ApiSuccessResponse<PortfolioRecordEntity>> {
    const data = await this.portfolioRecords.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(PORTFOLIO_LIBRARY_MODULE_KEY, "edit")
  @ApiOperation({
    summary:
      "Edit a portfolio record's content fields (increments version, never touches " +
      "approvalStatus/isPublished/publishedAt)",
  })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updatePortfolioRecordSchema)) body: UpdatePortfolioRecordDto,
    @Req() req: PortfolioLibraryRequest,
  ): Promise<ApiSuccessResponse<PortfolioRecordEntity>> {
    const data = await this.portfolioRecords.update(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve) and is checked dynamically inside the service itself, the same
  // layered pattern content-templates.controller.ts's/services.controller.ts's own status route
  // already established. PermissionGuard still runs (via @UseGuards below) checking only module
  // `view`, so a caller with no access to this module at all is still rejected at the route.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(PORTFOLIO_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a portfolio record's approval status" })
  async changeStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changePortfolioApprovalStatusSchema))
    body: ChangePortfolioApprovalStatusDto,
    @Req() req: PortfolioLibraryRequest,
  ): Promise<ApiSuccessResponse<PortfolioRecordEntity>> {
    const data = await this.portfolioRecords.changeApprovalStatus(
      id,
      body.approvalStatus,
      req.authUser!.id,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/publish")
  @HttpCode(HttpStatus.OK)
  // Same layered pattern as the status route above — the real gate is the "publish" action,
  // checked dynamically inside the service (which also enforces the approvalStatus === "approved"
  // business rule, D5) rather than a static @RequirePermission("publish") here, so the service's
  // own 400/404/409 outcomes are reachable before/instead of a blanket 403. PermissionGuard still
  // runs checking only module `view`.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(PORTFOLIO_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "Publish an approved portfolio record" })
  async publish(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: PortfolioLibraryRequest,
  ): Promise<ApiSuccessResponse<PortfolioRecordEntity>> {
    const data = await this.portfolioRecords.publish(id, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/unpublish")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(PORTFOLIO_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "Unpublish a portfolio record (allowed regardless of approvalStatus)" })
  async unpublish(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: PortfolioLibraryRequest,
  ): Promise<ApiSuccessResponse<PortfolioRecordEntity>> {
    const data = await this.portfolioRecords.unpublish(id, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}

/** Screenshots (D2) — assets aren't independently governed by the parent record's status
 *  workflow — gated on the same `MODULE_KEY` with `view`/`edit` actions, mirroring
 *  `CaseStudyAssetsController`'s own sub-resource gating pattern. */
@ApiTags("portfolio-library")
@Controller("portfolio-library/records/:recordId/screenshots")
@UseGuards(SessionGuard)
export class PortfolioAssetsController {
  constructor(private readonly portfolioAssets: PortfolioAssetsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(PORTFOLIO_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "List a portfolio record's linked screenshots" })
  async list(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Req() req: PortfolioLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly PortfolioAssetEntity[]>> {
    const data = await this.portfolioAssets.listByPortfolioRecord(recordId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(PORTFOLIO_LIBRARY_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Link a screenshot (asset) to a portfolio record" })
  async create(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Body(new ZodValidationPipe(createPortfolioAssetSchema)) body: CreatePortfolioAssetDto,
    @Req() req: PortfolioLibraryRequest,
  ): Promise<ApiSuccessResponse<PortfolioAssetEntity>> {
    const data = await this.portfolioAssets.create(recordId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(PORTFOLIO_LIBRARY_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Update a portfolio record's linked screenshot" })
  async update(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updatePortfolioAssetSchema)) body: UpdatePortfolioAssetDto,
    @Req() req: PortfolioLibraryRequest,
  ): Promise<ApiSuccessResponse<PortfolioAssetEntity>> {
    const data = await this.portfolioAssets.update(id, recordId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(PORTFOLIO_LIBRARY_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Unlink a screenshot from a portfolio record" })
  async remove(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: PortfolioLibraryRequest,
  ): Promise<void> {
    await this.portfolioAssets.remove(id, recordId, req.authUser!.id);
  }
}
