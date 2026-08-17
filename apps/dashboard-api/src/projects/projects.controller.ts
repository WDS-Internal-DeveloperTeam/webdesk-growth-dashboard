import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ProjectEntity } from "@webdesk/database";
import type { ApiSuccessResponse, UserSummary } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  assignApproverSchema,
  changeProjectStatusSchema,
  createProjectSchema,
  listProjectsQuerySchema,
  setActivePhaseSchema,
  updateProjectSchema,
  type AssignApproverDto,
  type ChangeProjectStatusDto,
  type CreateProjectDto,
  type ListProjectsQueryDto,
  type SetActivePhaseDto,
  type UpdateProjectDto,
} from "./projects.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ProjectService } from "./project.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- same reason as above.
import { ProjectApproversService } from "./project-approvers.service.js";

type ProjectsRequest = AuthenticatedRequest & RequestWithCorrelationId;

const MODULE_KEY = "project_configuration";

/**
 * The Projects module's own HTTP surface (`docs/task-packages/module-projects-foundation.md` §7).
 * Mutating routes use `POST .../update` etc. rather than `PATCH`/`PUT` — the only verb convention
 * used anywhere else in this codebase (see `OperationalContactsController`); `@Delete` is used only
 * where this codebase already establishes precedent (role revocation), and this module has no bare
 * hard-delete route for a project itself (archive-only, per rule 8). Routes below the collection
 * level use `:projectId` as the param name — `PermissionGuard` reads that exact name to resolve
 * project-scoped authorization (`permission.guard.ts`'s own doc comment already anticipated this
 * as its first real exercise).
 */
@ApiTags("projects")
@Controller("projects")
@UseGuards(SessionGuard)
export class ProjectsController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly approversService: ProjectApproversService,
  ) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List projects" })
  async list(
    @Query(new ZodValidationPipe(listProjectsQuerySchema)) query: ListProjectsQueryDto,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<readonly ProjectEntity[]>> {
    const data = await this.projectService.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a project" })
  async create(
    @Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectDto,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<ProjectEntity>> {
    const data = await this.projectService.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":projectId")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get a single project by id" })
  async getById(
    @Param("projectId") projectId: string,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<ProjectEntity>> {
    const data = await this.projectService.findById(projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":projectId/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Update a project's name/description/owner/confidentiality" })
  async update(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) body: UpdateProjectDto,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<ProjectEntity>> {
    const data = await this.projectService.update(projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":projectId/status")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Transition a project's status (active/paused/archived)" })
  async changeStatus(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(changeProjectStatusSchema)) body: ChangeProjectStatusDto,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<ProjectEntity>> {
    const data = await this.projectService.changeStatus(projectId, body.status, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":projectId/active-phase")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Set (or clear) a project's active roadmap phase" })
  async setActivePhase(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(setActivePhaseSchema)) body: SetActivePhaseDto,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<ProjectEntity>> {
    const data = await this.projectService.setActivePhase(
      projectId,
      body.roadmapItemId,
      req.authUser!.id,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":projectId/approvers")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({
    summary: "List the users currently holding owner_growth_approver for this project",
  })
  async listApprovers(
    @Param("projectId") projectId: string,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<readonly UserSummary[]>> {
    const data = await this.approversService.list(projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":projectId/approvers")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "approve")
  @ApiOperation({ summary: "Assign the owner_growth_approver role, scoped to this project" })
  async assignApprover(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(assignApproverSchema)) body: AssignApproverDto,
    @Req() req: ProjectsRequest,
  ): Promise<void> {
    await this.approversService.assign(projectId, body.userId, req.authUser!.id);
  }
}
