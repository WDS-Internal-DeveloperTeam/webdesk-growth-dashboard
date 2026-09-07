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
import type { SecretMetadataEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createSecretMetadataSchema,
  listSecretMetadataQuerySchema,
  updateSecretMetadataSchema,
  type CreateSecretMetadataDto,
  type ListSecretMetadataQueryDto,
  type UpdateSecretMetadataDto,
} from "./integrations.dto.js";
import { INTEGRATIONS_MODULE_KEY } from "./integrations.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { SecretMetadataService } from "./secret-metadata.service.js";

type IntegrationsRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("integrations")
@Controller("integrations/:integrationId/secret-metadata")
@UseGuards(SessionGuard)
export class SecretMetadataController {
  constructor(private readonly secrets: SecretMetadataService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "view")
  @ApiOperation({ summary: "List an integration's secret metadata (never the secret value)" })
  async list(
    @Param("integrationId", new ParseUUIDPipe()) integrationId: string,
    @Query(new ZodValidationPipe(listSecretMetadataQuerySchema)) query: ListSecretMetadataQueryDto,
    @Req() req: IntegrationsRequest,
  ): Promise<ApiSuccessResponse<readonly SecretMetadataEntity[]>> {
    const data = await this.secrets.listByIntegration(integrationId, query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":secretId")
  @UseGuards(PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one secret metadata record" })
  async findOne(
    @Param("integrationId", new ParseUUIDPipe()) integrationId: string,
    @Param("secretId", new ParseUUIDPipe()) secretId: string,
    @Req() req: IntegrationsRequest,
  ): Promise<ApiSuccessResponse<SecretMetadataEntity>> {
    const data = await this.secrets.findById(secretId, integrationId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "create")
  @ApiOperation({ summary: "Record which secret exists for an integration (never the value)" })
  async create(
    @Param("integrationId", new ParseUUIDPipe()) integrationId: string,
    @Body(new ZodValidationPipe(createSecretMetadataSchema)) body: CreateSecretMetadataDto,
    @Req() req: IntegrationsRequest,
  ): Promise<ApiSuccessResponse<SecretMetadataEntity>> {
    const data = await this.secrets.create(integrationId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":secretId/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Update a secret metadata record" })
  async update(
    @Param("integrationId", new ParseUUIDPipe()) integrationId: string,
    @Param("secretId", new ParseUUIDPipe()) secretId: string,
    @Body(new ZodValidationPipe(updateSecretMetadataSchema)) body: UpdateSecretMetadataDto,
    @Req() req: IntegrationsRequest,
  ): Promise<ApiSuccessResponse<SecretMetadataEntity>> {
    const data = await this.secrets.update(secretId, integrationId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Delete(":secretId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Remove a secret metadata record" })
  async remove(
    @Param("integrationId", new ParseUUIDPipe()) integrationId: string,
    @Param("secretId", new ParseUUIDPipe()) secretId: string,
    @Req() req: IntegrationsRequest,
  ): Promise<void> {
    await this.secrets.remove(secretId, integrationId, req.authUser!.id);
  }
}
