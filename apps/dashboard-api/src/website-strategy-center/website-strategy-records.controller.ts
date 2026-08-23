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
import type { WebsiteStrategyRecordEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeWebsiteStrategyApprovalStatusSchema,
  createWebsiteStrategyRecordSchema,
  listWebsiteStrategyRecordsQuerySchema,
  updateWebsiteStrategyRecordSchema,
  type ChangeWebsiteStrategyApprovalStatusDto,
  type CreateWebsiteStrategyRecordDto,
  type ListWebsiteStrategyRecordsQueryDto,
  type UpdateWebsiteStrategyRecordDto,
} from "./website-strategy-center.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { WebsiteStrategyRecordsService } from "./website-strategy-records.service.js";

type WebsiteStrategyCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

const MODULE_KEY = "website_strategy";

@ApiTags("website-strategy-center")
@Controller("website-strategy-center/records")
@UseGuards(SessionGuard)
export class WebsiteStrategyRecordsController {
  constructor(private readonly records: WebsiteStrategyRecordsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List website strategy records (current versions only)" })
  async list(
    @Query(new ZodValidationPipe(listWebsiteStrategyRecordsQuerySchema))
    query: ListWebsiteStrategyRecordsQueryDto,
    @Req() req: WebsiteStrategyCenterRequest,
  ): Promise<ApiSuccessResponse<readonly WebsiteStrategyRecordEntity[]>> {
    const data = await this.records.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":recordId")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get the current version of one website strategy record" })
  async findOne(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Req() req: WebsiteStrategyCenterRequest,
  ): Promise<ApiSuccessResponse<WebsiteStrategyRecordEntity>> {
    const data = await this.records.findCurrent(recordId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":recordId/versions")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get the full version history of one website strategy record" })
  async versions(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Req() req: WebsiteStrategyCenterRequest,
  ): Promise<ApiSuccessResponse<readonly WebsiteStrategyRecordEntity[]>> {
    const data = await this.records.listVersions(recordId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a website strategy record (always starts draft, version 1)" })
  async create(
    @Body(new ZodValidationPipe(createWebsiteStrategyRecordSchema))
    body: CreateWebsiteStrategyRecordDto,
    @Req() req: WebsiteStrategyCenterRequest,
  ): Promise<ApiSuccessResponse<WebsiteStrategyRecordEntity>> {
    const data = await this.records.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":recordId/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({
    summary:
      "Edit a website strategy record's content fields — mutates the current version in " +
      "place if it isn't approved yet, otherwise creates a new draft version",
  })
  async update(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Body(new ZodValidationPipe(updateWebsiteStrategyRecordSchema))
    body: UpdateWebsiteStrategyRecordDto,
    @Req() req: WebsiteStrategyCenterRequest,
  ): Promise<ApiSuccessResponse<WebsiteStrategyRecordEntity>> {
    const data = await this.records.update(recordId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":recordId/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve) and is checked dynamically inside the service itself, the same
  // layered pattern claims.controller.ts's/services.controller.ts's/personas.controller.ts's own
  // status route already established. PermissionGuard still runs (via @UseGuards below) checking
  // only module `view`, so a caller with no access to this module at all is still rejected at the
  // route. A successful "-> approved" transition additionally, atomically, supersedes the
  // record's previously-current-approved version, if one exists (task package D4).
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a website strategy record's approval status" })
  async changeStatus(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Body(new ZodValidationPipe(changeWebsiteStrategyApprovalStatusSchema))
    body: ChangeWebsiteStrategyApprovalStatusDto,
    @Req() req: WebsiteStrategyCenterRequest,
  ): Promise<ApiSuccessResponse<WebsiteStrategyRecordEntity>> {
    const data = await this.records.changeApprovalStatus(
      recordId,
      body.approvalStatus,
      req.authUser!.id,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
