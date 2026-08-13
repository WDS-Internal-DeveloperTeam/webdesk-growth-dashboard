import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type {
  RetentionHoldEntity,
  RetentionPolicyEntity,
  RetentionPolicyRepository,
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
  checkEligibilitySchema,
  createHoldSchema,
  listHoldsQuerySchema,
  releaseHoldSchema,
  type CheckEligibilityDto,
  type CreateHoldDto,
  type ListHoldsQueryDto,
  type ReleaseHoldDto,
} from "./retention.dto.js";
import type { EligibilityDecision } from "./retention-eligibility.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { RetentionEligibilityService } from "./retention-eligibility.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- same reason as RetentionEligibilityService above.
import { RetentionHoldService } from "./retention-hold.service.js";
import { RETENTION_POLICY_REPOSITORY } from "./retention.constants.js";

type RetentionRequest = AuthenticatedRequest & RequestWithCorrelationId;

/**
 * The retention domain's own HTTP surface (brief §28) — same "prove the
 * framework" role every other Phase 1E controller has played. Reuses
 * `system_settings` with the exact three action names §29 itself gives
 * (`retention_view`/`retention_configure`/`retention_hold`) — deny-by-
 * default until a separate, later authorization seeds real grants. See
 * docs/task-packages/phase-1e-retention-architecture.md §3. Deliberately
 * has NO cleanup/execute endpoint — `RetentionCleanupService` is proven
 * only at the service layer against a safe test fixture (§4 of the task
 * package), never reachable from an HTTP route.
 */
@ApiTags("retention")
@Controller("retention")
@UseGuards(SessionGuard)
export class RetentionController {
  constructor(
    @Inject(RETENTION_POLICY_REPOSITORY) private readonly policies: RetentionPolicyRepository,
    private readonly holdService: RetentionHoldService,
    private readonly eligibilityService: RetentionEligibilityService,
  ) {}

  @Get("policies")
  @UseGuards(PermissionGuard)
  @RequirePermission("system_settings", "retention_view")
  @ApiOperation({ summary: "List the 25 seeded, approved retention policies" })
  async listPolicies(
    @Req() req: RetentionRequest,
  ): Promise<ApiSuccessResponse<readonly RetentionPolicyEntity[]>> {
    const policies = await this.policies.listAll();
    return { success: true, data: policies, correlationId: req.correlationId ?? "unknown" };
  }

  @Get("holds")
  @UseGuards(PermissionGuard)
  @RequirePermission("system_settings", "retention_view")
  @ApiOperation({ summary: "List retention holds, optionally filtered by status" })
  async listHolds(
    @Query(new ZodValidationPipe(listHoldsQuerySchema)) query: ListHoldsQueryDto,
    @Req() req: RetentionRequest,
  ): Promise<ApiSuccessResponse<readonly RetentionHoldEntity[]>> {
    const holds = await this.holdService.listHolds(query);
    return { success: true, data: holds, correlationId: req.correlationId ?? "unknown" };
  }

  @Post("holds")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission("system_settings", "retention_hold")
  @ApiOperation({ summary: "Create a legal/retention hold — entity-scoped or category-scoped" })
  async createHold(
    @Body(new ZodValidationPipe(createHoldSchema)) body: CreateHoldDto,
    @Req() req: RetentionRequest,
  ): Promise<ApiSuccessResponse<RetentionHoldEntity>> {
    const hold = await this.holdService.createHold({
      ...body,
      createdByUserId: req.authUser!.id,
    });
    return { success: true, data: hold, correlationId: req.correlationId ?? "unknown" };
  }

  @Post("holds/:id/release")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission("system_settings", "retention_hold")
  @ApiOperation({ summary: "Release a hold — a release reason is always required and recorded" })
  async releaseHold(
    @Param("id") id: string,
    @Body(new ZodValidationPipe(releaseHoldSchema)) body: ReleaseHoldDto,
    @Req() req: RetentionRequest,
  ): Promise<ApiSuccessResponse<RetentionHoldEntity>> {
    const hold = await this.holdService.releaseHold(id, {
      releaseReason: body.releaseReason,
      releasedByUserId: req.authUser!.id,
    });
    return { success: true, data: hold, correlationId: req.correlationId ?? "unknown" };
  }

  @Post("eligibility")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission("system_settings", "retention_view")
  @ApiOperation({
    summary: "Check deletion eligibility for one record — read-only, never deletes anything",
  })
  async checkEligibility(
    @Body(new ZodValidationPipe(checkEligibilitySchema)) body: CheckEligibilityDto,
    @Req() req: RetentionRequest,
  ): Promise<ApiSuccessResponse<EligibilityDecision>> {
    const decision = await this.eligibilityService.evaluate(body);
    return { success: true, data: decision, correlationId: req.correlationId ?? "unknown" };
  }
}
