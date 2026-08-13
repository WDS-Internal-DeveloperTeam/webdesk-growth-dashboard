import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { IncidentSeverityPolicyEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  evaluateResponseTargetSchema,
  type EvaluateResponseTargetDto,
} from "./operational-contacts.dto.js";
import type { ResponseTargetEvaluation } from "./incident-severity.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { IncidentSeverityService } from "./incident-severity.service.js";

type SeverityRequest = AuthenticatedRequest & RequestWithCorrelationId;

/**
 * The incident-severity HTTP surface (brief §28) — read-only exposure of
 * the seeded §18 policy, same "safe, non-destructive, so exposing it as an
 * HTTP route is fine" reasoning `/retention/eligibility` used.
 */
@ApiTags("incident-severity")
@Controller("incident-severity")
@UseGuards(SessionGuard)
export class IncidentSeverityController {
  constructor(private readonly severityService: IncidentSeverityService) {}

  @Get("policies")
  @UseGuards(PermissionGuard)
  @RequirePermission("system_settings", "incident_severity_view")
  @ApiOperation({ summary: "List the 4 seeded, approved incident-severity response targets" })
  async listPolicies(
    @Req() req: SeverityRequest,
  ): Promise<ApiSuccessResponse<readonly IncidentSeverityPolicyEntity[]>> {
    const policies = await this.severityService.listPolicies();
    return { success: true, data: policies, correlationId: req.correlationId ?? "unknown" };
  }

  @Post("evaluate")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission("system_settings", "incident_severity_view")
  @ApiOperation({
    summary:
      "Evaluate a response target against caller-supplied timestamps — never fabricates SLA compliance from a real incident, since no incident-tracking system exists yet",
  })
  async evaluate(
    @Body(new ZodValidationPipe(evaluateResponseTargetSchema)) body: EvaluateResponseTargetDto,
    @Req() req: SeverityRequest,
  ): Promise<ApiSuccessResponse<ResponseTargetEvaluation>> {
    const evaluation = await this.severityService.evaluateResponseTarget(
      body.severity,
      body.incidentOpenedAt,
      body.now,
    );
    return { success: true, data: evaluation, correlationId: req.correlationId ?? "unknown" };
  }
}
