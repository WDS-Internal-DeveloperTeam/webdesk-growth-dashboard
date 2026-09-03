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
import type { DeploymentEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createDeploymentSchema,
  listDeploymentsQuerySchema,
  type CreateDeploymentDto,
  type ListDeploymentsQueryDto,
} from "./release-center.dto.js";
import { RELEASE_CENTER_MODULE_KEY } from "./release-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { DeploymentsService } from "./deployments.service.js";

type ReleaseCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("release-center")
@Controller("release-center/projects/:projectId/releases/:releaseId/deployments")
@UseGuards(SessionGuard)
export class DeploymentsController {
  constructor(private readonly deployments: DeploymentsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(RELEASE_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "List a release's deploy attempts" })
  async list(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("releaseId", new ParseUUIDPipe()) releaseId: string,
    @Query(new ZodValidationPipe(listDeploymentsQuerySchema)) query: ListDeploymentsQueryDto,
    @Req() req: ReleaseCenterRequest,
  ): Promise<ApiSuccessResponse<readonly DeploymentEntity[]>> {
    const data = await this.deployments.list(projectId, releaseId, query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(RELEASE_CENTER_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Record a new deploy attempt for a release" })
  async create(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("releaseId", new ParseUUIDPipe()) releaseId: string,
    @Body(new ZodValidationPipe(createDeploymentSchema)) body: CreateDeploymentDto,
    @Req() req: ReleaseCenterRequest,
  ): Promise<ApiSuccessResponse<DeploymentEntity>> {
    const data = await this.deployments.create(projectId, releaseId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
