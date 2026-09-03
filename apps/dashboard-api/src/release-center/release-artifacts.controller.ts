import {
  Body,
  Controller,
  Delete,
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
import type { ReleaseArtifactEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createReleaseArtifactSchema,
  listReleaseArtifactsQuerySchema,
  type CreateReleaseArtifactDto,
  type ListReleaseArtifactsQueryDto,
} from "./release-center.dto.js";
import { RELEASE_CENTER_MODULE_KEY } from "./release-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ReleaseArtifactsService } from "./release-artifacts.service.js";

type ReleaseCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("release-center")
@Controller("release-center/projects/:projectId/releases/:releaseId/artifacts")
@UseGuards(SessionGuard)
export class ReleaseArtifactsController {
  constructor(private readonly artifacts: ReleaseArtifactsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(RELEASE_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "List a release's artifacts (repositories/SHAs/PRs)" })
  async list(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("releaseId", new ParseUUIDPipe()) releaseId: string,
    @Query(new ZodValidationPipe(listReleaseArtifactsQuerySchema))
    query: ListReleaseArtifactsQueryDto,
    @Req() req: ReleaseCenterRequest,
  ): Promise<ApiSuccessResponse<readonly ReleaseArtifactEntity[]>> {
    const data = await this.artifacts.list(projectId, releaseId, query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(RELEASE_CENTER_MODULE_KEY, "create")
  @ApiOperation({ summary: "Attach a new artifact (repository/SHA/PR) to a release" })
  async create(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("releaseId", new ParseUUIDPipe()) releaseId: string,
    @Body(new ZodValidationPipe(createReleaseArtifactSchema)) body: CreateReleaseArtifactDto,
    @Req() req: ReleaseCenterRequest,
  ): Promise<ApiSuccessResponse<ReleaseArtifactEntity>> {
    const data = await this.artifacts.create(projectId, releaseId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Delete(":artifactId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(RELEASE_CENTER_MODULE_KEY, "edit")
  @ApiOperation({
    summary:
      "Remove an artifact from a release (rejected once the release is completed/rolled back)",
  })
  async remove(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("releaseId", new ParseUUIDPipe()) releaseId: string,
    @Param("artifactId", new ParseUUIDPipe()) artifactId: string,
    @Req() req: ReleaseCenterRequest,
  ): Promise<void> {
    await this.artifacts.remove(projectId, releaseId, artifactId, req.authUser!.id);
  }
}
