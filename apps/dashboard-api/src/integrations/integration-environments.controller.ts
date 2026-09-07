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
import type { IntegrationEnvironmentEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createIntegrationEnvironmentSchema,
  listIntegrationEnvironmentsQuerySchema,
  updateIntegrationEnvironmentSchema,
  type CreateIntegrationEnvironmentDto,
  type ListIntegrationEnvironmentsQueryDto,
  type UpdateIntegrationEnvironmentDto,
} from "./integrations.dto.js";
import { INTEGRATIONS_MODULE_KEY } from "./integrations.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { IntegrationEnvironmentsService } from "./integration-environments.service.js";

type IntegrationsRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("integrations")
@Controller("integrations/:integrationId/environments")
@UseGuards(SessionGuard)
export class IntegrationEnvironmentsController {
  constructor(private readonly environments: IntegrationEnvironmentsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "view")
  @ApiOperation({ summary: "List an integration's environments" })
  async list(
    @Param("integrationId", new ParseUUIDPipe()) integrationId: string,
    @Query(new ZodValidationPipe(listIntegrationEnvironmentsQuerySchema))
    query: ListIntegrationEnvironmentsQueryDto,
    @Req() req: IntegrationsRequest,
  ): Promise<ApiSuccessResponse<readonly IntegrationEnvironmentEntity[]>> {
    const data = await this.environments.listByIntegration(integrationId, query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":environmentId")
  @UseGuards(PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one integration environment" })
  async findOne(
    @Param("integrationId", new ParseUUIDPipe()) integrationId: string,
    @Param("environmentId", new ParseUUIDPipe()) environmentId: string,
    @Req() req: IntegrationsRequest,
  ): Promise<ApiSuccessResponse<IntegrationEnvironmentEntity>> {
    const data = await this.environments.findById(environmentId, integrationId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "create")
  @ApiOperation({ summary: "Add an environment to an integration" })
  async create(
    @Param("integrationId", new ParseUUIDPipe()) integrationId: string,
    @Body(new ZodValidationPipe(createIntegrationEnvironmentSchema))
    body: CreateIntegrationEnvironmentDto,
    @Req() req: IntegrationsRequest,
  ): Promise<ApiSuccessResponse<IntegrationEnvironmentEntity>> {
    const data = await this.environments.create(integrationId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":environmentId/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Update an integration environment" })
  async update(
    @Param("integrationId", new ParseUUIDPipe()) integrationId: string,
    @Param("environmentId", new ParseUUIDPipe()) environmentId: string,
    @Body(new ZodValidationPipe(updateIntegrationEnvironmentSchema))
    body: UpdateIntegrationEnvironmentDto,
    @Req() req: IntegrationsRequest,
  ): Promise<ApiSuccessResponse<IntegrationEnvironmentEntity>> {
    const data = await this.environments.update(
      environmentId,
      integrationId,
      body,
      req.authUser!.id,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Delete(":environmentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Remove an integration environment" })
  async remove(
    @Param("integrationId", new ParseUUIDPipe()) integrationId: string,
    @Param("environmentId", new ParseUUIDPipe()) environmentId: string,
    @Req() req: IntegrationsRequest,
  ): Promise<void> {
    await this.environments.remove(environmentId, integrationId, req.authUser!.id);
  }
}
