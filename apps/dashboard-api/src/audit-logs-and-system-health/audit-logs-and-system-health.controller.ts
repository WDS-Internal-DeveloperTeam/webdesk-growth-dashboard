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
import { AUDIT_LOGS_AND_SYSTEM_HEALTH_RBAC_MODULE_KEY } from "./audit-logs-and-system-health.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { AuditLogsAndSystemHealthService } from "./audit-logs-and-system-health.service.js";
import {
  listAuditLogsAndSystemHealthEventsQuerySchema,
  type ListAuditLogsAndSystemHealthEventsQueryDto,
} from "./audit-logs-and-system-health.dto.js";

type AuditLogsAndSystemHealthRequest = AuthenticatedRequest & RequestWithCorrelationId;

/**
 * The Audit Logs and System Health module's HTTP surface (module #43,
 * `docs/implementation/module-audit-logs-and-system-health.md`) — a read-only query view over the
 * existing ADR-0017 `audit_events` table, gated on the already-seeded `system_settings`
 * permission group verbatim, mirroring Decision and Activity Log's own controller file-for-file.
 * No writes — `AuditService.record()` remains the sole write path, called by other modules' own
 * services, never from here. Does NOT re-expose `jobs`/`system-events`/`system-health` under this
 * module's own route prefix — those already have real, live endpoints elsewhere in the API
 * surface (`jobs.controller.ts`, `system-operations.controller.ts`).
 */
@ApiTags("audit-logs-and-system-health")
@Controller("audit-logs-and-system-health")
@UseGuards(SessionGuard)
export class AuditLogsAndSystemHealthController {
  constructor(private readonly auditLogsAndSystemHealth: AuditLogsAndSystemHealthService) {}

  @Get("events")
  @UseGuards(PermissionGuard)
  @RequirePermission(AUDIT_LOGS_AND_SYSTEM_HEALTH_RBAC_MODULE_KEY, "view")
  @ApiOperation({
    summary:
      "List audit-logs/system-health events (login, permission changes, jobs/queues, webhooks, retention/backups, notifications, operational contacts, system health checks, emergency-admin access, account recovery) — a read over audit_events, scoped to this module's own event-type allowlist",
  })
  async listEvents(
    @Query(new ZodValidationPipe(listAuditLogsAndSystemHealthEventsQuerySchema))
    query: ListAuditLogsAndSystemHealthEventsQueryDto,
    @Req() req: AuditLogsAndSystemHealthRequest,
  ): Promise<ApiSuccessResponse<readonly AuditEventEntity[]>> {
    const events = await this.auditLogsAndSystemHealth.list(query);
    return { success: true, data: events, correlationId: req.correlationId ?? "unknown" };
  }
}
