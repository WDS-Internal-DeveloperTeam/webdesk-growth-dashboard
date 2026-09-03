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
import type { SmokeTestEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createSmokeTestSchema,
  listSmokeTestsQuerySchema,
  type CreateSmokeTestDto,
  type ListSmokeTestsQueryDto,
} from "./release-center.dto.js";
import { RELEASE_CENTER_MODULE_KEY } from "./release-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { SmokeTestsService } from "./smoke-tests.service.js";

type ReleaseCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("release-center")
@Controller("release-center/projects/:projectId/releases/:releaseId/smoke-tests")
@UseGuards(SessionGuard)
export class SmokeTestsController {
  constructor(private readonly smokeTests: SmokeTestsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(RELEASE_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "List a release's smoke-test results" })
  async list(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("releaseId", new ParseUUIDPipe()) releaseId: string,
    @Query(new ZodValidationPipe(listSmokeTestsQuerySchema)) query: ListSmokeTestsQueryDto,
    @Req() req: ReleaseCenterRequest,
  ): Promise<ApiSuccessResponse<readonly SmokeTestEntity[]>> {
    const data = await this.smokeTests.list(projectId, releaseId, query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(RELEASE_CENTER_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Record a new smoke-test result for a release" })
  async create(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("releaseId", new ParseUUIDPipe()) releaseId: string,
    @Body(new ZodValidationPipe(createSmokeTestSchema)) body: CreateSmokeTestDto,
    @Req() req: ReleaseCenterRequest,
  ): Promise<ApiSuccessResponse<SmokeTestEntity>> {
    const data = await this.smokeTests.create(projectId, releaseId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
