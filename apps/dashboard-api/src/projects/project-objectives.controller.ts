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
import type { ProjectObjectiveEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createObjectiveSchema,
  updateObjectiveSchema,
  type CreateObjectiveDto,
  type UpdateObjectiveDto,
} from "./projects.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ProjectObjectivesService } from "./project-objectives.service.js";

type ProjectsRequest = AuthenticatedRequest & RequestWithCorrelationId;
const MODULE_KEY = "project_configuration";

@ApiTags("projects")
@Controller("projects/:projectId/objectives")
@UseGuards(SessionGuard)
export class ProjectObjectivesController {
  constructor(private readonly objectives: ProjectObjectivesService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List a project's objectives" })
  async list(
    @Param("projectId") projectId: string,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<readonly ProjectObjectiveEntity[]>> {
    const data = await this.objectives.listByProject(projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Add an objective to a project" })
  async create(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(createObjectiveSchema)) body: CreateObjectiveDto,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<ProjectObjectiveEntity>> {
    const data = await this.objectives.create(projectId, body.description, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":objectiveId/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Update a project objective" })
  async update(
    @Param("objectiveId") objectiveId: string,
    @Body(new ZodValidationPipe(updateObjectiveSchema)) body: UpdateObjectiveDto,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<ProjectObjectiveEntity>> {
    const data = await this.objectives.update(objectiveId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Delete(":objectiveId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Remove a project objective" })
  async remove(@Param("objectiveId") objectiveId: string): Promise<void> {
    await this.objectives.remove(objectiveId);
  }
}
