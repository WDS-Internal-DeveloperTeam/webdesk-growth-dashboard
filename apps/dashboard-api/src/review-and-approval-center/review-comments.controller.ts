import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ReviewCommentEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createReviewCommentSchema,
  type CreateReviewCommentDto,
} from "./review-and-approval-center.dto.js";
import { REVIEW_AND_APPROVAL_CENTER_MODULE_KEY } from "./review-and-approval-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ReviewCommentsService } from "./review-comments.service.js";

type ReviewAndApprovalCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

/** Comments aren't independently governed by the parent review's `status`/`is_paused` — gated on
 *  the same module key with `view`/`review` actions (task package D10), mirroring
 *  `ClaimSourcesController`'s own sub-resource gating pattern
 *  (`apps/dashboard-api/src/proof-and-claims-library/claim-sources.controller.ts`). */
@ApiTags("review-and-approval-center")
@Controller("reviews/:reviewId/comments")
@UseGuards(SessionGuard)
export class ReviewCommentsController {
  constructor(private readonly comments: ReviewCommentsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(REVIEW_AND_APPROVAL_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "List a review's comments" })
  async list(
    @Param("reviewId", new ParseUUIDPipe()) reviewId: string,
    @Req() req: ReviewAndApprovalCenterRequest,
  ): Promise<ApiSuccessResponse<readonly ReviewCommentEntity[]>> {
    const data = await this.comments.listByReview(reviewId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(REVIEW_AND_APPROVAL_CENTER_MODULE_KEY, "review")
  @ApiOperation({ summary: "Add a comment to a review" })
  async create(
    @Param("reviewId", new ParseUUIDPipe()) reviewId: string,
    @Body(new ZodValidationPipe(createReviewCommentSchema)) body: CreateReviewCommentDto,
    @Req() req: ReviewAndApprovalCenterRequest,
  ): Promise<ApiSuccessResponse<ReviewCommentEntity>> {
    const data = await this.comments.create(reviewId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
