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
import type { ReviewDecisionEntity, ReviewEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createReviewSchema,
  decideReviewSchema,
  delegateReviewSchema,
  listReviewsQuerySchema,
  setReviewPausedSchema,
  type CreateReviewDto,
  type DecideReviewDto,
  type DelegateReviewDto,
  type ListReviewsQueryDto,
  type SetReviewPausedDto,
} from "./review-and-approval-center.dto.js";
import { REVIEW_AND_APPROVAL_CENTER_MODULE_KEY } from "./review-and-approval-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ReviewsService } from "./reviews.service.js";

type ReviewAndApprovalCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("review-and-approval-center")
@Controller("reviews")
@UseGuards(SessionGuard)
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(REVIEW_AND_APPROVAL_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "List reviews, optionally filtered (?assignedToMe=true supported)" })
  async list(
    @Query(new ZodValidationPipe(listReviewsQuerySchema)) query: ListReviewsQueryDto,
    @Req() req: ReviewAndApprovalCenterRequest,
  ): Promise<ApiSuccessResponse<readonly ReviewEntity[]>> {
    const data = await this.reviews.list(query, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(REVIEW_AND_APPROVAL_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one review" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ReviewAndApprovalCenterRequest,
  ): Promise<ApiSuccessResponse<ReviewEntity>> {
    const data = await this.reviews.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id/decisions")
  @UseGuards(PermissionGuard)
  @RequirePermission(REVIEW_AND_APPROVAL_CENTER_MODULE_KEY, "view")
  @ApiOperation({
    summary:
      "List a review's decision history (this module's own local, queryable action log — task package D1)",
  })
  async listDecisions(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ReviewAndApprovalCenterRequest,
  ): Promise<ApiSuccessResponse<readonly ReviewDecisionEntity[]>> {
    const data = await this.reviews.listDecisions(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(REVIEW_AND_APPROVAL_CENTER_MODULE_KEY, "create")
  @ApiOperation({ summary: "Submit a new review request" })
  async create(
    @Body(new ZodValidationPipe(createReviewSchema)) body: CreateReviewDto,
    @Req() req: ReviewAndApprovalCenterRequest,
  ): Promise<ApiSuccessResponse<ReviewEntity>> {
    const data = await this.reviews.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/decide")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies by the requested `action`
  // (approve/approve_with_notes/reject need "approve"; request_revision needs only "review") and
  // is checked dynamically inside the service itself, the same layered pattern
  // content-templates.controller.ts's own status route already established. PermissionGuard still
  // runs (via @UseGuards below) checking the weaker "review" action, so a caller with no access to
  // this module's review workflow at all is still rejected at the route.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(REVIEW_AND_APPROVAL_CENTER_MODULE_KEY, "review")
  @ApiOperation({
    summary: "Approve, approve with notes, request revision, or reject a review (atomic CAS)",
  })
  async decide(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(decideReviewSchema)) body: DecideReviewDto,
    @Req() req: ReviewAndApprovalCenterRequest,
  ): Promise<ApiSuccessResponse<ReviewEntity>> {
    const data = await this.reviews.decide(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/pause")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(REVIEW_AND_APPROVAL_CENTER_MODULE_KEY, "review")
  @ApiOperation({ summary: "Pause or resume a review (advisory only, orthogonal to status)" })
  async setPaused(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(setReviewPausedSchema)) body: SetReviewPausedDto,
    @Req() req: ReviewAndApprovalCenterRequest,
  ): Promise<ApiSuccessResponse<ReviewEntity>> {
    const data = await this.reviews.setPaused(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/delegate")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(REVIEW_AND_APPROVAL_CENTER_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Reassign a review to a different assignee" })
  async delegate(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(delegateReviewSchema)) body: DelegateReviewDto,
    @Req() req: ReviewAndApprovalCenterRequest,
  ): Promise<ApiSuccessResponse<ReviewEntity>> {
    const data = await this.reviews.delegate(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
