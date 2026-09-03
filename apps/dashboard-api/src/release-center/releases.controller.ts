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
import type { ReleaseApprovalEntity, ReleaseEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeReleaseStatusSchema,
  createReleaseSchema,
  listReleasesQuerySchema,
  updateReleaseSchema,
  type ChangeReleaseStatusDto,
  type CreateReleaseDto,
  type ListReleasesQueryDto,
  type UpdateReleaseDto,
} from "./release-center.dto.js";
import { RELEASE_CENTER_MODULE_KEY } from "./release-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ReleasesService } from "./releases.service.js";

type ReleaseCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

/** `@RequirePermission` is placed on every individual method, never at class level —
 *  `PermissionGuard` only reads `context.getHandler()` (a deliberate fail-closed design). `:projectId`
 *  is a real route path parameter, not a query/body field, mirroring
 *  `TechnicalCheckRunsController`'s own shape exactly. */
@ApiTags("release-center")
@Controller("release-center/projects/:projectId/releases")
@UseGuards(SessionGuard)
export class ReleasesController {
  constructor(private readonly releases: ReleasesService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(RELEASE_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "List releases for a project, optionally filtered" })
  async list(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Query(new ZodValidationPipe(listReleasesQuerySchema)) query: ListReleasesQueryDto,
    @Req() req: ReleaseCenterRequest,
  ): Promise<ApiSuccessResponse<readonly ReleaseEntity[]>> {
    const data = await this.releases.list({ ...query, projectId });
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(RELEASE_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one release" })
  async findOne(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ReleaseCenterRequest,
  ): Promise<ApiSuccessResponse<ReleaseEntity>> {
    const data = await this.releases.findById(id, projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id/approvals")
  @UseGuards(PermissionGuard)
  @RequirePermission(RELEASE_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "List a release's approval decision history" })
  async listApprovals(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ReleaseCenterRequest,
  ): Promise<ApiSuccessResponse<readonly ReleaseApprovalEntity[]>> {
    const data = await this.releases.listApprovals(id, projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(RELEASE_CENTER_MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a release (always starts proposed)" })
  async create(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Body(new ZodValidationPipe(createReleaseSchema)) body: CreateReleaseDto,
    @Req() req: ReleaseCenterRequest,
  ): Promise<ApiSuccessResponse<ReleaseEntity>> {
    const data = await this.releases.create(projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(RELEASE_CENTER_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Edit a release's content fields (never touches status)" })
  async update(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateReleaseSchema)) body: UpdateReleaseDto,
    @Req() req: ReleaseCenterRequest,
  ): Promise<ApiSuccessResponse<ReleaseEntity>> {
    const data = await this.releases.update(id, projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("release"/"approve"/...) here — the real gate varies per requested
  // transition (submit/review/approve/release) and is checked dynamically inside the service
  // itself, the same layered pattern TechnicalCheckRunsController.changeStatus()'s/
  // CaseStudiesController.changeStatus()'s own status routes already established. PermissionGuard
  // still runs (via @UseGuards below) checking only module `view`, so a caller with no access to
  // this module at all is still rejected at the route.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(RELEASE_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a release's status" })
  async changeStatus(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeReleaseStatusSchema)) body: ChangeReleaseStatusDto,
    @Req() req: ReleaseCenterRequest,
  ): Promise<ApiSuccessResponse<ReleaseEntity>> {
    const data = await this.releases.changeStatus(id, projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
