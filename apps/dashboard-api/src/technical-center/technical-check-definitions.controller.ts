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
import type { TechnicalCheckDefinitionEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createTechnicalCheckDefinitionSchema,
  listTechnicalCheckDefinitionsQuerySchema,
  updateTechnicalCheckDefinitionSchema,
  type CreateTechnicalCheckDefinitionDto,
  type ListTechnicalCheckDefinitionsQueryDto,
  type UpdateTechnicalCheckDefinitionDto,
} from "./technical-center.dto.js";
import { TECHNICAL_CENTER_MODULE_KEY } from "./technical-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { TechnicalCheckDefinitionsService } from "./technical-check-definitions.service.js";

type TechnicalCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

/** `@RequirePermission` is placed on every individual method, never at class level —
 *  `PermissionGuard` only reads `context.getHandler()` (a deliberate fail-closed design). `:projectId`
 *  is a real route path parameter, not a query/body field, mirroring `ScanDefinitionsController`'s
 *  own shape exactly. No status/workflow route here — definitions have no workflow of their own. */
@ApiTags("technical-center")
@Controller("technical-center/projects/:projectId/definitions")
@UseGuards(SessionGuard)
export class TechnicalCheckDefinitionsController {
  constructor(private readonly definitions: TechnicalCheckDefinitionsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(TECHNICAL_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "List technical check definitions for a project, optionally filtered" })
  async list(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Query(new ZodValidationPipe(listTechnicalCheckDefinitionsQuerySchema))
    query: ListTechnicalCheckDefinitionsQueryDto,
    @Req() req: TechnicalCenterRequest,
  ): Promise<ApiSuccessResponse<readonly TechnicalCheckDefinitionEntity[]>> {
    const data = await this.definitions.list({ ...query, projectId });
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(TECHNICAL_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one technical check definition" })
  async findOne(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: TechnicalCenterRequest,
  ): Promise<ApiSuccessResponse<TechnicalCheckDefinitionEntity>> {
    const data = await this.definitions.findById(id, projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(TECHNICAL_CENTER_MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a technical check definition" })
  async create(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Body(new ZodValidationPipe(createTechnicalCheckDefinitionSchema))
    body: CreateTechnicalCheckDefinitionDto,
    @Req() req: TechnicalCenterRequest,
  ): Promise<ApiSuccessResponse<TechnicalCheckDefinitionEntity>> {
    const data = await this.definitions.create(projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(TECHNICAL_CENTER_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Edit a technical check definition" })
  async update(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateTechnicalCheckDefinitionSchema))
    body: UpdateTechnicalCheckDefinitionDto,
    @Req() req: TechnicalCenterRequest,
  ): Promise<ApiSuccessResponse<TechnicalCheckDefinitionEntity>> {
    const data = await this.definitions.update(id, projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
