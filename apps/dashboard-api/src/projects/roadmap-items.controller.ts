import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { RoadmapItemEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createRoadmapItemSchema,
  updateRoadmapItemSchema,
  type CreateRoadmapItemDto,
  type UpdateRoadmapItemDto,
} from "./projects.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { RoadmapItemsService } from "./roadmap-items.service.js";

type ProjectsRequest = AuthenticatedRequest & RequestWithCorrelationId;
const MODULE_KEY = "project_configuration";

/** "Phases"/"roadmap" (task package D3) — represented by one entity, `roadmap_items`. */
@ApiTags("projects")
@Controller("projects/:projectId/roadmap-items")
@UseGuards(SessionGuard)
export class RoadmapItemsController {
  constructor(private readonly roadmapItems: RoadmapItemsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List a project's roadmap items" })
  async list(
    @Param("projectId") projectId: string,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<readonly RoadmapItemEntity[]>> {
    const data = await this.roadmapItems.listByProject(projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Add a roadmap item to a project" })
  async create(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(createRoadmapItemSchema)) body: CreateRoadmapItemDto,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<RoadmapItemEntity>> {
    const data = await this.roadmapItems.create(projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":roadmapItemId/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Update a roadmap item's name/sequence" })
  async update(
    @Param("projectId") projectId: string,
    @Param("roadmapItemId") roadmapItemId: string,
    @Body(new ZodValidationPipe(updateRoadmapItemSchema)) body: UpdateRoadmapItemDto,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<RoadmapItemEntity>> {
    const data = await this.roadmapItems.update(roadmapItemId, projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Delete(":roadmapItemId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({
    summary: "Remove a roadmap item (rejected if it is the project's current active phase)",
  })
  async remove(
    @Param("projectId") projectId: string,
    @Param("roadmapItemId") roadmapItemId: string,
    @Req() req: ProjectsRequest,
  ): Promise<void> {
    await this.roadmapItems.remove(roadmapItemId, projectId, req.authUser!.id);
  }
}
