import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type {
  SystemComponentEntity,
  SystemEventEntity,
  SystemHealthCheckEntity,
} from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  listActivityQuerySchema,
  recordCheckSchema,
  type ListActivityQueryDto,
  type RecordCheckDto,
} from "./system-operations.dto.js";
import type { CurrentStatus } from "./system-health.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { SystemActivityService } from "./system-activity.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- same reason as SystemActivityService above.
import { SystemHealthService } from "./system-health.service.js";

type SystemOpsRequest = AuthenticatedRequest & RequestWithCorrelationId;

/**
 * The system-events/health HTTP surface (brief §28) — same "prove the
 * framework" role every other Phase 1E controller has played. Reuses
 * `system_settings` with the exact action names §29 itself gives
 * (`system_health_view`, `system_settings_configure`) — deny-by-default
 * until a separate, later authorization seeds real grants. See
 * docs/task-packages/phase-1e-system-events-health.md §6.
 */
@ApiTags("system-operations")
@Controller()
@UseGuards(SessionGuard)
export class SystemOperationsController {
  constructor(
    private readonly activityService: SystemActivityService,
    private readonly healthService: SystemHealthService,
  ) {}

  @Get("system-events")
  @UseGuards(PermissionGuard)
  @RequirePermission("system_settings", "system_health_view")
  @ApiOperation({ summary: "List the system activity feed — never the compliance audit trail" })
  async listActivity(
    @Query(new ZodValidationPipe(listActivityQuerySchema)) query: ListActivityQueryDto,
    @Req() req: SystemOpsRequest,
  ): Promise<ApiSuccessResponse<readonly SystemEventEntity[]>> {
    const events = await this.activityService.list(query);
    return { success: true, data: events, correlationId: req.correlationId ?? "unknown" };
  }

  @Get("system-health/components")
  @UseGuards(PermissionGuard)
  @RequirePermission("system_settings", "system_health_view")
  @ApiOperation({ summary: "List the 10 seeded, approved system components" })
  async listComponents(
    @Req() req: SystemOpsRequest,
  ): Promise<ApiSuccessResponse<readonly SystemComponentEntity[]>> {
    const components = await this.healthService.listComponents();
    return { success: true, data: components, correlationId: req.correlationId ?? "unknown" };
  }

  @Get("system-health/status")
  @UseGuards(PermissionGuard)
  @RequirePermission("system_settings", "system_health_view")
  @ApiOperation({
    summary:
      "Current status of every component — a component with no recorded checks reports 'unknown', never 'healthy'",
  })
  async getAllStatuses(
    @Req() req: SystemOpsRequest,
  ): Promise<ApiSuccessResponse<readonly CurrentStatus[]>> {
    const statuses = await this.healthService.getAllCurrentStatuses();
    return { success: true, data: statuses, correlationId: req.correlationId ?? "unknown" };
  }

  @Get("system-health/status/:componentKey")
  @UseGuards(PermissionGuard)
  @RequirePermission("system_settings", "system_health_view")
  @ApiOperation({ summary: "Current status of a single component" })
  async getStatus(
    @Param("componentKey") componentKey: string,
    @Req() req: SystemOpsRequest,
  ): Promise<ApiSuccessResponse<CurrentStatus>> {
    const status = await this.healthService.getCurrentStatus(componentKey);
    return { success: true, data: status, correlationId: req.correlationId ?? "unknown" };
  }

  @Post("system-health/checks")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission("system_settings", "system_settings_configure")
  @ApiOperation({ summary: "Manually record a health-check observation for a component" })
  async recordCheck(
    @Body(new ZodValidationPipe(recordCheckSchema)) body: RecordCheckDto,
    @Req() req: SystemOpsRequest,
  ): Promise<ApiSuccessResponse<SystemHealthCheckEntity>> {
    const check = await this.healthService.recordCheck({
      ...body,
      checkedByUserId: req.authUser!.id,
      source: "manual",
      correlationId: req.correlationId ?? null,
    });
    return { success: true, data: check, correlationId: req.correlationId ?? "unknown" };
  }
}
