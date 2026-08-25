import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { PageArtifactEntity, PageArtifactVersionEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import { PAGE_WORKSPACE_BASE_MODULE_KEY } from "./page-workspace.constants.js";
import {
  changeVersionStatusSchema,
  createArtifactSchema,
  listVersionsQuerySchema,
  reopenArtifactSchema,
  updateArtifactVersionSchema,
  type ChangeVersionStatusDto,
  type CreateArtifactDto,
  type ListVersionsQueryDto,
  type ReopenArtifactDto,
  type UpdateArtifactVersionDto,
} from "./page-workspace.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { PageArtifactsService } from "./page-artifacts.service.js";

type PageWorkspaceRequest = AuthenticatedRequest & RequestWithCorrelationId;

/**
 * `@RequirePermission` is on every individual method, never at class level — `PermissionGuard`
 * only reads `context.getHandler()` (a deliberate fail-closed design), the exact bug Service
 * Library's dimensions controller shipped with once.
 *
 * The decorator here is a BASELINE gate only (`page_content:view`, held by all seven seeded
 * roles). The authoritative check is per artifact type, inside the service — task package D2 —
 * because the required permission group varies by which tab is being touched, which no static
 * decorator can express. This mirrors `ServicesService.changeApprovalStatus()`'s own layered
 * shape.
 *
 * `:projectId` is a real path parameter so `PermissionGuard` can resolve project-scoped grants —
 * it only reads `request.params?.projectId`, the exact gap Page Inventory's own code review found
 * when its routes carried the project only in the query or body.
 */
@ApiTags("page-workspace")
@Controller("page-workspace/projects/:projectId/pages/:pageId/artifacts")
@UseGuards(SessionGuard)
export class PageArtifactsController {
  constructor(private readonly artifacts: PageArtifactsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(PAGE_WORKSPACE_BASE_MODULE_KEY, "view")
  @ApiOperation({ summary: "List every artifact (tab) that exists for a page" })
  async list(
    @Req() req: PageWorkspaceRequest,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("pageId", ParseUUIDPipe) pageId: string,
  ): Promise<ApiSuccessResponse<readonly PageArtifactEntity[]>> {
    const data = await this.artifacts.listForPage(req.authUser!.id, projectId, pageId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @UseGuards(PermissionGuard, OriginCheckGuard)
  @RequirePermission(PAGE_WORKSPACE_BASE_MODULE_KEY, "view")
  @ApiOperation({ summary: "Create a page artifact and its first draft version" })
  async create(
    @Req() req: PageWorkspaceRequest,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("pageId", ParseUUIDPipe) pageId: string,
    @Body(new ZodValidationPipe(createArtifactSchema)) body: CreateArtifactDto,
  ): Promise<
    ApiSuccessResponse<{ artifact: PageArtifactEntity; version: PageArtifactVersionEntity }>
  > {
    const data = await this.artifacts.createArtifact(req.authUser!.id, projectId, pageId, body);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  /** The "History" tab (task package D3) — a derived view, which is exactly why `history` is not
   *  itself one of the 15 stored artifact types. */
  @Get(":artifactId/versions")
  @UseGuards(PermissionGuard)
  @RequirePermission(PAGE_WORKSPACE_BASE_MODULE_KEY, "view")
  @ApiOperation({ summary: "List an artifact's version history, newest first" })
  async listVersions(
    @Req() req: PageWorkspaceRequest,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("pageId", ParseUUIDPipe) pageId: string,
    @Param("artifactId", ParseUUIDPipe) artifactId: string,
    @Query(new ZodValidationPipe(listVersionsQuerySchema)) query: ListVersionsQueryDto,
  ): Promise<ApiSuccessResponse<readonly PageArtifactVersionEntity[]>> {
    const data = await this.artifacts.listVersions(
      req.authUser!.id,
      projectId,
      pageId,
      artifactId,
      query,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Patch(":artifactId/versions/:versionId")
  @UseGuards(PermissionGuard, OriginCheckGuard)
  @RequirePermission(PAGE_WORKSPACE_BASE_MODULE_KEY, "view")
  @ApiOperation({ summary: "Edit a draft version in place (approved versions are immutable)" })
  async updateVersion(
    @Req() req: PageWorkspaceRequest,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("pageId", ParseUUIDPipe) pageId: string,
    @Param("artifactId", ParseUUIDPipe) artifactId: string,
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @Body(new ZodValidationPipe(updateArtifactVersionSchema)) body: UpdateArtifactVersionDto,
  ): Promise<ApiSuccessResponse<PageArtifactVersionEntity>> {
    const data = await this.artifacts.updateVersion(
      req.authUser!.id,
      projectId,
      pageId,
      artifactId,
      versionId,
      body,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":artifactId/versions/:versionId/status")
  @UseGuards(PermissionGuard, OriginCheckGuard)
  @RequirePermission(PAGE_WORKSPACE_BASE_MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a version's status (submit, review, approve, reject)" })
  async changeVersionStatus(
    @Req() req: PageWorkspaceRequest,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("pageId", ParseUUIDPipe) pageId: string,
    @Param("artifactId", ParseUUIDPipe) artifactId: string,
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @Body(new ZodValidationPipe(changeVersionStatusSchema)) body: ChangeVersionStatusDto,
  ): Promise<ApiSuccessResponse<PageArtifactVersionEntity>> {
    const data = await this.artifacts.changeVersionStatus(
      req.authUser!.id,
      projectId,
      pageId,
      artifactId,
      versionId,
      body,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":artifactId/versions/:versionId/reopen")
  @UseGuards(PermissionGuard, OriginCheckGuard)
  @RequirePermission(PAGE_WORKSPACE_BASE_MODULE_KEY, "view")
  @ApiOperation({ summary: "Reopen an approved version, forking a new draft and recording why" })
  async reopen(
    @Req() req: PageWorkspaceRequest,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("pageId", ParseUUIDPipe) pageId: string,
    @Param("artifactId", ParseUUIDPipe) artifactId: string,
    @Param("versionId", ParseUUIDPipe) versionId: string,
    @Body(new ZodValidationPipe(reopenArtifactSchema)) body: ReopenArtifactDto,
  ): Promise<ApiSuccessResponse<PageArtifactVersionEntity>> {
    const data = await this.artifacts.reopen(
      req.authUser!.id,
      projectId,
      pageId,
      artifactId,
      versionId,
      body,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
