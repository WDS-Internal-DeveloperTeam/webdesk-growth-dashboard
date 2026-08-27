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
import type { DesignReferenceRecordEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeDesignReferenceApprovalStatusSchema,
  createDesignReferenceRecordSchema,
  listDesignReferenceRecordsQuerySchema,
  updateDesignReferenceRecordSchema,
  type ChangeDesignReferenceApprovalStatusDto,
  type CreateDesignReferenceRecordDto,
  type ListDesignReferenceRecordsQueryDto,
  type UpdateDesignReferenceRecordDto,
} from "./design-reference-library.dto.js";
import { DESIGN_REFERENCE_LIBRARY_MODULE_KEY } from "./design-reference-library.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { DesignReferenceLibraryService } from "./design-reference-library.service.js";

type DesignReferenceLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("design-reference-library")
@Controller("design-reference-library/records")
@UseGuards(SessionGuard)
export class DesignReferenceLibraryController {
  constructor(private readonly designReferenceLibrary: DesignReferenceLibraryService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(DESIGN_REFERENCE_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "List design reference records, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listDesignReferenceRecordsQuerySchema))
    query: ListDesignReferenceRecordsQueryDto,
    @Req() req: DesignReferenceLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly DesignReferenceRecordEntity[]>> {
    const data = await this.designReferenceLibrary.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(DESIGN_REFERENCE_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one design reference record" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: DesignReferenceLibraryRequest,
  ): Promise<ApiSuccessResponse<DesignReferenceRecordEntity>> {
    const data = await this.designReferenceLibrary.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(DESIGN_REFERENCE_LIBRARY_MODULE_KEY, "create")
  @ApiOperation({
    summary: "Create a design reference record (always starts draft, unpublished)",
  })
  async create(
    @Body(new ZodValidationPipe(createDesignReferenceRecordSchema))
    body: CreateDesignReferenceRecordDto,
    @Req() req: DesignReferenceLibraryRequest,
  ): Promise<ApiSuccessResponse<DesignReferenceRecordEntity>> {
    const data = await this.designReferenceLibrary.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(DESIGN_REFERENCE_LIBRARY_MODULE_KEY, "edit")
  @ApiOperation({
    summary:
      "Edit a design reference record's content fields (increments version, never touches " +
      "approvalStatus/isPublished/publishedAt)",
  })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateDesignReferenceRecordSchema))
    body: UpdateDesignReferenceRecordDto,
    @Req() req: DesignReferenceLibraryRequest,
  ): Promise<ApiSuccessResponse<DesignReferenceRecordEntity>> {
    const data = await this.designReferenceLibrary.update(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve) and is checked dynamically inside the service itself, the same
  // layered pattern brand-library.controller.ts's own status route already established.
  // PermissionGuard still runs (via @UseGuards below) checking only module `view`, so a caller
  // with no access to this module at all is still rejected at the route.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(DESIGN_REFERENCE_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a design reference record's approval status" })
  async changeStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeDesignReferenceApprovalStatusSchema))
    body: ChangeDesignReferenceApprovalStatusDto,
    @Req() req: DesignReferenceLibraryRequest,
  ): Promise<ApiSuccessResponse<DesignReferenceRecordEntity>> {
    const data = await this.designReferenceLibrary.changeApprovalStatus(
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
  @RequirePermission(DESIGN_REFERENCE_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "Publish an approved design reference record" })
  async publish(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: DesignReferenceLibraryRequest,
  ): Promise<ApiSuccessResponse<DesignReferenceRecordEntity>> {
    const data = await this.designReferenceLibrary.publish(id, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/unpublish")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(DESIGN_REFERENCE_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({
    summary: "Unpublish a design reference record (allowed regardless of approvalStatus)",
  })
  async unpublish(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: DesignReferenceLibraryRequest,
  ): Promise<ApiSuccessResponse<DesignReferenceRecordEntity>> {
    const data = await this.designReferenceLibrary.unpublish(id, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
