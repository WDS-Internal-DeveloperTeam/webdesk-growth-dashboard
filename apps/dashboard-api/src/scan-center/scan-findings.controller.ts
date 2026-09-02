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
import type { ScanFindingEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeScanFindingStatusSchema,
  listScanFindingsQuerySchema,
  type ChangeScanFindingStatusDto,
  type ListScanFindingsQueryDto,
} from "./scan-center.dto.js";
import { SCAN_CENTER_MODULE_KEY } from "./scan-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ScanFindingsService } from "./scan-findings.service.js";

type ScanCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

/** No `POST` (create) route here — findings are only ever created as a side effect of
 *  `ScanRunsService.changeStatus()`'s own terminal-with-findings transition. */
@ApiTags("scan-center")
@Controller("scan-center/projects/:projectId/findings")
@UseGuards(SessionGuard)
export class ScanFindingsController {
  constructor(private readonly findings: ScanFindingsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(SCAN_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "List scan findings for a project, optionally filtered" })
  async list(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Query(new ZodValidationPipe(listScanFindingsQuerySchema)) query: ListScanFindingsQueryDto,
    @Req() req: ScanCenterRequest,
  ): Promise<ApiSuccessResponse<readonly ScanFindingEntity[]>> {
    const data = await this.findings.list({ ...query, projectId });
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(SCAN_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one scan finding" })
  async findOne(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ScanCenterRequest,
  ): Promise<ApiSuccessResponse<ScanFindingEntity>> {
    const data = await this.findings.findById(id, projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("review") here at the route gate — the real action a transition
  // requires is checked dynamically inside the service (mirrors ScanRunsController's own layered
  // pattern).
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(SCAN_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a scan finding's status" })
  async changeStatus(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeScanFindingStatusSchema)) body: ChangeScanFindingStatusDto,
    @Req() req: ScanCenterRequest,
  ): Promise<ApiSuccessResponse<ScanFindingEntity>> {
    const data = await this.findings.changeStatus(id, projectId, body.status, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
