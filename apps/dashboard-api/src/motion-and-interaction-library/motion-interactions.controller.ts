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
import type { MotionInteractionRecordEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import { MODULE_KEY } from "./motion-and-interaction-library.constants.js";
import {
  changeMotionInteractionApprovalStatusSchema,
  createMotionInteractionRecordSchema,
  listMotionInteractionRecordsQuerySchema,
  updateMotionInteractionRecordSchema,
  type ChangeMotionInteractionApprovalStatusDto,
  type CreateMotionInteractionRecordDto,
  type ListMotionInteractionRecordsQueryDto,
  type UpdateMotionInteractionRecordDto,
} from "./motion-and-interaction-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { MotionInteractionsService } from "./motion-interactions.service.js";

type MotionAndInteractionLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("motion-and-interaction-library")
@Controller("motion-and-interaction-library/records")
@UseGuards(SessionGuard)
export class MotionInteractionsController {
  constructor(private readonly interactions: MotionInteractionsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List motion/interaction records (current versions only)" })
  async list(
    @Query(new ZodValidationPipe(listMotionInteractionRecordsQuerySchema))
    query: ListMotionInteractionRecordsQueryDto,
    @Req() req: MotionAndInteractionLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly MotionInteractionRecordEntity[]>> {
    const data = await this.interactions.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":recordId")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get the current version of one motion/interaction record" })
  async findOne(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Req() req: MotionAndInteractionLibraryRequest,
  ): Promise<ApiSuccessResponse<MotionInteractionRecordEntity>> {
    const data = await this.interactions.findCurrent(recordId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":recordId/versions")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get the full version history of one motion/interaction record" })
  async versions(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Req() req: MotionAndInteractionLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly MotionInteractionRecordEntity[]>> {
    const data = await this.interactions.listVersions(recordId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a motion/interaction record (always starts draft, version 1)" })
  async create(
    @Body(new ZodValidationPipe(createMotionInteractionRecordSchema))
    body: CreateMotionInteractionRecordDto,
    @Req() req: MotionAndInteractionLibraryRequest,
  ): Promise<ApiSuccessResponse<MotionInteractionRecordEntity>> {
    const data = await this.interactions.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":recordId/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({
    summary:
      "Edit a motion/interaction record's fields — mutates the current version in place if " +
      "it isn't approved yet, otherwise creates a new draft version",
  })
  async update(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Body(new ZodValidationPipe(updateMotionInteractionRecordSchema))
    body: UpdateMotionInteractionRecordDto,
    @Req() req: MotionAndInteractionLibraryRequest,
  ): Promise<ApiSuccessResponse<MotionInteractionRecordEntity>> {
    const data = await this.interactions.update(recordId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":recordId/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve) and is checked dynamically inside the service itself, the same
  // layered pattern section-patterns.controller.ts's/page-templates.controller.ts's own status
  // route already established. PermissionGuard still runs (via @UseGuards below) checking only
  // module `view`, so a caller with no access to this module at all is still rejected at the
  // route. A successful "-> approved" transition additionally, atomically, supersedes the
  // record's previously-current-approved version, if one exists.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a motion/interaction record's approval status" })
  async changeStatus(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Body(new ZodValidationPipe(changeMotionInteractionApprovalStatusSchema))
    body: ChangeMotionInteractionApprovalStatusDto,
    @Req() req: MotionAndInteractionLibraryRequest,
  ): Promise<ApiSuccessResponse<MotionInteractionRecordEntity>> {
    const data = await this.interactions.changeApprovalStatus(
      recordId,
      body.approvalStatus,
      req.authUser!.id,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
