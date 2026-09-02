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
import type { TechnicalFindingEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeTechnicalFindingStatusSchema,
  listTechnicalFindingsQuerySchema,
  type ChangeTechnicalFindingStatusDto,
  type ListTechnicalFindingsQueryDto,
} from "./technical-center.dto.js";
import { TECHNICAL_CENTER_MODULE_KEY } from "./technical-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { TechnicalFindingsService } from "./technical-findings.service.js";

type TechnicalCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

/** No `POST` (create) route here — findings are only ever created as a side effect of
 *  `TechnicalCheckRunsService.changeStatus()`'s own terminal-with-findings transition. */
@ApiTags("technical-center")
@Controller("technical-center/projects/:projectId/findings")
@UseGuards(SessionGuard)
export class TechnicalFindingsController {
  constructor(private readonly findings: TechnicalFindingsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(TECHNICAL_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "List technical findings for a project, optionally filtered" })
  async list(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Query(new ZodValidationPipe(listTechnicalFindingsQuerySchema))
    query: ListTechnicalFindingsQueryDto,
    @Req() req: TechnicalCenterRequest,
  ): Promise<ApiSuccessResponse<readonly TechnicalFindingEntity[]>> {
    const data = await this.findings.list({ ...query, projectId });
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(TECHNICAL_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one technical finding" })
  async findOne(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: TechnicalCenterRequest,
  ): Promise<ApiSuccessResponse<TechnicalFindingEntity>> {
    const data = await this.findings.findById(id, projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("review") here at the route gate — the real action a transition
  // requires is checked dynamically inside the service (mirrors
  // TechnicalCheckRunsController's own layered pattern).
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(TECHNICAL_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a technical finding's status" })
  async changeStatus(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeTechnicalFindingStatusSchema))
    body: ChangeTechnicalFindingStatusDto,
    @Req() req: TechnicalCenterRequest,
  ): Promise<ApiSuccessResponse<TechnicalFindingEntity>> {
    const data = await this.findings.changeStatus(id, projectId, body.status, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
