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
import type { ProjectUserEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import { addProjectUserSchema, type AddProjectUserDto } from "./projects.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ProjectTeamService } from "./project-team.service.js";

type ProjectsRequest = AuthenticatedRequest & RequestWithCorrelationId;
const MODULE_KEY = "project_configuration";

/** The project team roster (task package D4) — grants no authorization by itself; see `ProjectApproversService` for actual project-scoped role assignment. */
@ApiTags("projects")
@Controller("projects/:projectId/team")
@UseGuards(SessionGuard)
export class ProjectTeamController {
  constructor(private readonly team: ProjectTeamService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List a project's team roster" })
  async list(
    @Param("projectId") projectId: string,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<readonly ProjectUserEntity[]>> {
    const data = await this.team.listByProject(projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Add a user to a project's team roster" })
  async add(
    @Param("projectId") projectId: string,
    @Body(new ZodValidationPipe(addProjectUserSchema)) body: AddProjectUserDto,
    @Req() req: ProjectsRequest,
  ): Promise<ApiSuccessResponse<ProjectUserEntity>> {
    const data = await this.team.add(projectId, body.userId, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Delete(":teamEntryId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Remove a user from a project's team roster" })
  async remove(@Param("teamEntryId") teamEntryId: string): Promise<void> {
    await this.team.remove(teamEntryId);
  }
}
