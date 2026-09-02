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
import type { ScanRunEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeScanRunStatusSchema,
  createScanRunSchema,
  listScanRunsQuerySchema,
  type ChangeScanRunStatusDto,
  type CreateScanRunDto,
  type ListScanRunsQueryDto,
} from "./scan-center.dto.js";
import { SCAN_CENTER_MODULE_KEY } from "./scan-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ScanRunsService } from "./scan-runs.service.js";

type ScanCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("scan-center")
@Controller("scan-center/projects/:projectId/runs")
@UseGuards(SessionGuard)
export class ScanRunsController {
  constructor(private readonly runs: ScanRunsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(SCAN_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "List scan runs for a project, optionally filtered" })
  async list(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Query(new ZodValidationPipe(listScanRunsQuerySchema)) query: ListScanRunsQueryDto,
    @Req() req: ScanCenterRequest,
  ): Promise<ApiSuccessResponse<readonly ScanRunEntity[]>> {
    const data = await this.runs.list({ ...query, projectId });
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(SCAN_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one scan run" })
  async findOne(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ScanCenterRequest,
  ): Promise<ApiSuccessResponse<ScanRunEntity>> {
    const data = await this.runs.findById(id, projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(SCAN_CENTER_MODULE_KEY, "create")
  @ApiOperation({ summary: "Create (request) a scan run against an enabled scan definition" })
  async create(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Body(new ZodValidationPipe(createScanRunSchema)) body: CreateScanRunDto,
    @Req() req: ScanCenterRequest,
  ): Promise<ApiSuccessResponse<ScanRunEntity>> {
    const data = await this.runs.create(projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("edit") here at the class-level route gate — every real transition
  // requires `edit`, but the check runs dynamically inside the service (mirrors
  // InternalLinksController's own layered pattern), so a caller with no module access at all is
  // still rejected by the route's own baseline `view` grant.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(SCAN_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a scan run's status" })
  async changeStatus(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeScanRunStatusSchema)) body: ChangeScanRunStatusDto,
    @Req() req: ScanCenterRequest,
  ): Promise<ApiSuccessResponse<ScanRunEntity>> {
    const data = await this.runs.changeStatus(id, projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
