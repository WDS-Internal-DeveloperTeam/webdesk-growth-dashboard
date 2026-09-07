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
import type { IntegrationEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createIntegrationSchema,
  listIntegrationsQuerySchema,
  toggleIntegrationActiveSchema,
  updateIntegrationSchema,
  verifyIntegrationSchema,
  type CreateIntegrationDto,
  type ListIntegrationsQueryDto,
  type ToggleIntegrationActiveDto,
  type UpdateIntegrationDto,
  type VerifyIntegrationDto,
} from "./integrations.dto.js";
import { INTEGRATIONS_MODULE_KEY } from "./integrations.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { IntegrationsService } from "./integrations.service.js";

type IntegrationsRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("integrations")
@Controller("integrations")
@UseGuards(SessionGuard)
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "view")
  @ApiOperation({ summary: "List integrations, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listIntegrationsQuerySchema)) query: ListIntegrationsQueryDto,
    @Req() req: IntegrationsRequest,
  ): Promise<ApiSuccessResponse<readonly IntegrationEntity[]>> {
    const data = await this.integrations.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one integration" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: IntegrationsRequest,
  ): Promise<ApiSuccessResponse<IntegrationEntity>> {
    const data = await this.integrations.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "create")
  @ApiOperation({ summary: "Create an integration (record-keeping only, no real outbound call)" })
  async create(
    @Body(new ZodValidationPipe(createIntegrationSchema)) body: CreateIntegrationDto,
    @Req() req: IntegrationsRequest,
  ): Promise<ApiSuccessResponse<IntegrationEntity>> {
    const data = await this.integrations.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "edit")
  @ApiOperation({
    summary: "Edit an integration's content fields (never touches status/lastVerified*/isActive)",
  })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateIntegrationSchema)) body: UpdateIntegrationDto,
    @Req() req: IntegrationsRequest,
  ): Promise<ApiSuccessResponse<IntegrationEntity>> {
    const data = await this.integrations.update(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/verify")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "review")
  @ApiOperation({
    summary: "Record a manual verification result (no real outbound call is made)",
  })
  async verify(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(verifyIntegrationSchema)) body: VerifyIntegrationDto,
    @Req() req: IntegrationsRequest,
  ): Promise<ApiSuccessResponse<IntegrationEntity>> {
    const data = await this.integrations.verify(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/toggle-active")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "configure")
  @ApiOperation({ summary: "Toggle whether an integration is active (the retirement mechanism)" })
  async toggleActive(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(toggleIntegrationActiveSchema))
    body: ToggleIntegrationActiveDto,
    @Req() req: IntegrationsRequest,
  ): Promise<ApiSuccessResponse<IntegrationEntity>> {
    const data = await this.integrations.setActive(id, body.isActive, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
