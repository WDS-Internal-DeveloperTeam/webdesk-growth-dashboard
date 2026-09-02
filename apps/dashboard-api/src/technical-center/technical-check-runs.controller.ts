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
import type { TechnicalCheckRunEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeTechnicalCheckRunStatusSchema,
  createTechnicalCheckRunSchema,
  listTechnicalCheckRunsQuerySchema,
  type ChangeTechnicalCheckRunStatusDto,
  type CreateTechnicalCheckRunDto,
  type ListTechnicalCheckRunsQueryDto,
} from "./technical-center.dto.js";
import { TECHNICAL_CENTER_MODULE_KEY } from "./technical-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { TechnicalCheckRunsService } from "./technical-check-runs.service.js";

type TechnicalCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("technical-center")
@Controller("technical-center/projects/:projectId/runs")
@UseGuards(SessionGuard)
export class TechnicalCheckRunsController {
  constructor(private readonly runs: TechnicalCheckRunsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(TECHNICAL_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "List technical check runs for a project, optionally filtered" })
  async list(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Query(new ZodValidationPipe(listTechnicalCheckRunsQuerySchema))
    query: ListTechnicalCheckRunsQueryDto,
    @Req() req: TechnicalCenterRequest,
  ): Promise<ApiSuccessResponse<readonly TechnicalCheckRunEntity[]>> {
    const data = await this.runs.list({ ...query, projectId });
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(TECHNICAL_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one technical check run" })
  async findOne(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: TechnicalCenterRequest,
  ): Promise<ApiSuccessResponse<TechnicalCheckRunEntity>> {
    const data = await this.runs.findById(id, projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(TECHNICAL_CENTER_MODULE_KEY, "create")
  @ApiOperation({ summary: "Create (request) a technical check run against an enabled definition" })
  async create(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Body(new ZodValidationPipe(createTechnicalCheckRunSchema)) body: CreateTechnicalCheckRunDto,
    @Req() req: TechnicalCenterRequest,
  ): Promise<ApiSuccessResponse<TechnicalCheckRunEntity>> {
    const data = await this.runs.create(projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("edit") here at the class-level route gate — every real transition
  // requires `edit`, but the check runs dynamically inside the service (mirrors
  // ScanRunsController's own layered pattern), so a caller with no module access at all is still
  // rejected by the route's own baseline `view` grant.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(TECHNICAL_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a technical check run's status" })
  async changeStatus(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeTechnicalCheckRunStatusSchema))
    body: ChangeTechnicalCheckRunStatusDto,
    @Req() req: TechnicalCenterRequest,
  ): Promise<ApiSuccessResponse<TechnicalCheckRunEntity>> {
    const data = await this.runs.changeStatus(id, projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
