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
import type { ProjectRepositoryEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createProjectRepositorySchema,
  updateProjectRepositorySchema,
  type CreateProjectRepositoryDto,
  type UpdateProjectRepositoryDto,
} from "./projects.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ProjectRepositoriesService } from "./project-repositories.service.js";

type ProjectsRequest = AuthenticatedRequest & RequestWithCorrelationId;
const MODULE_KEY = "project_configuration";

/** No live GitHub validation — reference/display metadata only (task package D5). */
@ApiTags("projects")
@Controller("projects/:projectId/repositories")
@UseGuards(SessionGuard)
export class ProjectRepositoriesController {
  constructor(private readonly repositories: ProjectRepositoriesService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List a project's linked repositories" })
  async list(
    @Param("projectId") projectId: string,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<readonly ProjectRepositoryEntity[]>> {
    const data = await this.repositories.listByProject(projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Link a repository to a project (metadata only)" })
  async create(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(createProjectRepositorySchema)) body: CreateProjectRepositoryDto,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<ProjectRepositoryEntity>> {
    const data = await this.repositories.create(projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":repositoryId/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Update a project's linked repository metadata" })
  async update(
    @Param("projectId") projectId: string,
    @Param("repositoryId") repositoryId: string,
    @Body(new ZodValidationPipe(updateProjectRepositorySchema)) body: UpdateProjectRepositoryDto,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<ProjectRepositoryEntity>> {
    const data = await this.repositories.update(repositoryId, projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Delete(":repositoryId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Unlink a repository from a project" })
  async remove(
    @Param("projectId") projectId: string,
    @Param("repositoryId") repositoryId: string,
  ): Promise<void> {
    await this.repositories.remove(repositoryId, projectId);
  }
}
