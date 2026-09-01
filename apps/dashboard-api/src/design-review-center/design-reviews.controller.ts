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
import type { DesignReviewDecisionEntity, DesignReviewEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createDesignReviewSchema,
  decideDesignReviewSchema,
  listDesignReviewsQuerySchema,
  type CreateDesignReviewDto,
  type DecideDesignReviewDto,
  type ListDesignReviewsQueryDto,
} from "./design-review-center.dto.js";
import { DESIGN_REVIEW_CENTER_MODULE_KEY } from "./design-review-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { DesignReviewsService } from "./design-reviews.service.js";

type DesignReviewCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("design-review-center")
@Controller("design-reviews")
@UseGuards(SessionGuard)
export class DesignReviewsController {
  constructor(private readonly designReviews: DesignReviewsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(DESIGN_REVIEW_CENTER_MODULE_KEY, "view")
  @ApiOperation({
    summary:
      "List design reviews, optionally filtered (?reviewType=, ?assignedToMe=true supported)",
  })
  async list(
    @Query(new ZodValidationPipe(listDesignReviewsQuerySchema)) query: ListDesignReviewsQueryDto,
    @Req() req: DesignReviewCenterRequest,
  ): Promise<ApiSuccessResponse<readonly DesignReviewEntity[]>> {
    const data = await this.designReviews.list(query, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(DESIGN_REVIEW_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one design review" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: DesignReviewCenterRequest,
  ): Promise<ApiSuccessResponse<DesignReviewEntity>> {
    const data = await this.designReviews.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id/decisions")
  @UseGuards(PermissionGuard)
  @RequirePermission(DESIGN_REVIEW_CENTER_MODULE_KEY, "view")
  @ApiOperation({
    summary:
      "List a design review's decision history (this module's own local, queryable action log)",
  })
  async listDecisions(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: DesignReviewCenterRequest,
  ): Promise<ApiSuccessResponse<readonly DesignReviewDecisionEntity[]>> {
    const data = await this.designReviews.listDecisions(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(DESIGN_REVIEW_CENTER_MODULE_KEY, "create")
  @ApiOperation({ summary: "Submit a new design review request" })
  async create(
    @Body(new ZodValidationPipe(createDesignReviewSchema)) body: CreateDesignReviewDto,
    @Req() req: DesignReviewCenterRequest,
  ): Promise<ApiSuccessResponse<DesignReviewEntity>> {
    const data = await this.designReviews.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/decide")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies by the requested `action`
  // (approve/approve_with_notes/reject need "approve"; request_revision needs only "review") and
  // is checked dynamically inside the service itself, mirroring
  // ReviewsController.decide()'s/content-templates.controller.ts's own status route. PermissionGuard
  // still runs (via @UseGuards below) checking the weaker "review" action, so a caller with no
  // access to this module's review workflow at all is still rejected at the route.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(DESIGN_REVIEW_CENTER_MODULE_KEY, "review")
  @ApiOperation({
    summary:
      "Approve, approve with notes, request revision, or reject a design review (atomic CAS; " +
      "approving may automatically supersede another approved review for the same target+reviewType)",
  })
  async decide(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(decideDesignReviewSchema)) body: DecideDesignReviewDto,
    @Req() req: DesignReviewCenterRequest,
  ): Promise<ApiSuccessResponse<DesignReviewEntity>> {
    const data = await this.designReviews.decide(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
