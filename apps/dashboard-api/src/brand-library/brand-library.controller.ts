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
import type { BrandLibraryRecordEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeBrandLibraryApprovalStatusSchema,
  createBrandLibraryRecordSchema,
  listBrandLibraryRecordsQuerySchema,
  updateBrandLibraryRecordSchema,
  type ChangeBrandLibraryApprovalStatusDto,
  type CreateBrandLibraryRecordDto,
  type ListBrandLibraryRecordsQueryDto,
  type UpdateBrandLibraryRecordDto,
} from "./brand-library.dto.js";
import { BRAND_LIBRARY_MODULE_KEY } from "./brand-library.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { BrandLibraryService } from "./brand-library.service.js";

type BrandLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("brand-library")
@Controller("brand-library/records")
@UseGuards(SessionGuard)
export class BrandLibraryController {
  constructor(private readonly brandLibrary: BrandLibraryService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(BRAND_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "List brand library records, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listBrandLibraryRecordsQuerySchema))
    query: ListBrandLibraryRecordsQueryDto,
    @Req() req: BrandLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly BrandLibraryRecordEntity[]>> {
    const data = await this.brandLibrary.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(BRAND_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one brand library record" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: BrandLibraryRequest,
  ): Promise<ApiSuccessResponse<BrandLibraryRecordEntity>> {
    const data = await this.brandLibrary.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(BRAND_LIBRARY_MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a brand library record (always starts draft, unpublished)" })
  async create(
    @Body(new ZodValidationPipe(createBrandLibraryRecordSchema)) body: CreateBrandLibraryRecordDto,
    @Req() req: BrandLibraryRequest,
  ): Promise<ApiSuccessResponse<BrandLibraryRecordEntity>> {
    const data = await this.brandLibrary.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(BRAND_LIBRARY_MODULE_KEY, "edit")
  @ApiOperation({
    summary:
      "Edit a brand library record's content fields (increments version, never touches " +
      "approvalStatus/isPublished/publishedAt)",
  })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateBrandLibraryRecordSchema)) body: UpdateBrandLibraryRecordDto,
    @Req() req: BrandLibraryRequest,
  ): Promise<ApiSuccessResponse<BrandLibraryRecordEntity>> {
    const data = await this.brandLibrary.update(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve) and is checked dynamically inside the service itself, the same
  // layered pattern content-templates.controller.ts's own status route already established.
  // PermissionGuard still runs (via @UseGuards below) checking only module `view`, so a caller
  // with no access to this module at all is still rejected at the route.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(BRAND_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a brand library record's approval status" })
  async changeStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeBrandLibraryApprovalStatusSchema))
    body: ChangeBrandLibraryApprovalStatusDto,
    @Req() req: BrandLibraryRequest,
  ): Promise<ApiSuccessResponse<BrandLibraryRecordEntity>> {
    const data = await this.brandLibrary.changeApprovalStatus(
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
  // business rule) rather than a static @RequirePermission("publish") here, so the service's own
  // 400/404/409 outcomes are reachable before/instead of a blanket 403. PermissionGuard still runs
  // checking only module `view`.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(BRAND_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "Publish an approved brand library record" })
  async publish(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: BrandLibraryRequest,
  ): Promise<ApiSuccessResponse<BrandLibraryRecordEntity>> {
    const data = await this.brandLibrary.publish(id, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/unpublish")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(BRAND_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({
    summary: "Unpublish a brand library record (allowed regardless of approvalStatus)",
  })
  async unpublish(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: BrandLibraryRequest,
  ): Promise<ApiSuccessResponse<BrandLibraryRecordEntity>> {
    const data = await this.brandLibrary.unpublish(id, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
