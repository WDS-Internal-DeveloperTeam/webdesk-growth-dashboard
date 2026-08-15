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
import type { ProjectEnvironmentEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createEnvironmentSchema,
  updateEnvironmentSchema,
  type CreateEnvironmentDto,
  type UpdateEnvironmentDto,
} from "./projects.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ProjectEnvironmentsService } from "./project-environments.service.js";

type ProjectsRequest = AuthenticatedRequest & RequestWithCorrelationId;
const MODULE_KEY = "project_configuration";

@ApiTags("projects")
@Controller("projects/:projectId/environments")
@UseGuards(SessionGuard)
export class ProjectEnvironmentsController {
  constructor(private readonly environments: ProjectEnvironmentsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List a project's environments" })
  async list(
    @Param("projectId") projectId: string,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<readonly ProjectEnvironmentEntity[]>> {
    const data = await this.environments.listByProject(projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Add an environment to a project" })
  async create(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(createEnvironmentSchema)) body: CreateEnvironmentDto,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<ProjectEnvironmentEntity>> {
    const data = await this.environments.create(projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":environmentId/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Update a project environment" })
  async update(
    @Param("environmentId") environmentId: string,
    @Body(new ZodValidationPipe(updateEnvironmentSchema)) body: UpdateEnvironmentDto,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<ProjectEnvironmentEntity>> {
    const data = await this.environments.update(environmentId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Delete(":environmentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Remove a project environment" })
  async remove(@Param("environmentId") environmentId: string): Promise<void> {
    await this.environments.remove(environmentId);
  }
}
