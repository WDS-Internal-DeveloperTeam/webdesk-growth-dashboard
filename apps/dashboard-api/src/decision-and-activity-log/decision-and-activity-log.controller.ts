import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { AuditEventEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import { DECISION_AND_ACTIVITY_LOG_RBAC_MODULE_KEY } from "./decision-and-activity-log.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { DecisionAndActivityLogService } from "./decision-and-activity-log.service.js";
import {
  listDecisionAndActivityLogEventsQuerySchema,
  type ListDecisionAndActivityLogEventsQueryDto,
} from "./decision-and-activity-log.dto.js";

type DecisionAndActivityLogRequest = AuthenticatedRequest & RequestWithCorrelationId;

/**
 * The Decision and Activity Log module's HTTP surface (module #37,
 * `docs/implementation/module-decision-and-activity-log.md`) — a
 * read-only, human-friendly query view over the existing ADR-0017
 * `audit_events` table, gated on the already-seeded `system_settings`
 * permission group verbatim (migration `00015`'s own doc comment: "not a
 * claim that system_settings is their final, approved gate"). No writes
 * — `AuditService.record()` remains the sole write path, called by other
 * modules' own services, never from here.
 */
@ApiTags("decision-and-activity-log")
@Controller("decision-and-activity-log")
@UseGuards(SessionGuard)
export class DecisionAndActivityLogController {
  constructor(private readonly decisionAndActivityLog: DecisionAndActivityLogService) {}

  @Get("events")
  @UseGuards(PermissionGuard)
  @RequirePermission(DECISION_AND_ACTIVITY_LOG_RBAC_MODULE_KEY, "view")
  @ApiOperation({
    summary:
      "List decision/activity audit events (business decisions, approvals, rollback, backup/restore, scan, import/export, Git sync, security exceptions) — a human-friendly read over audit_events, scoped to this module's own event-type allowlist",
  })
  async listEvents(
    @Query(new ZodValidationPipe(listDecisionAndActivityLogEventsQuerySchema))
    query: ListDecisionAndActivityLogEventsQueryDto,
    @Req() req: DecisionAndActivityLogRequest,
  ): Promise<ApiSuccessResponse<readonly AuditEventEntity[]>> {
    const events = await this.decisionAndActivityLog.list(query);
    return { success: true, data: events, correlationId: req.correlationId ?? "unknown" };
  }
}
