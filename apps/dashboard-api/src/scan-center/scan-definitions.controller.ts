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
import type { ScanDefinitionEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createScanDefinitionSchema,
  listScanDefinitionsQuerySchema,
  updateScanDefinitionSchema,
  type CreateScanDefinitionDto,
  type ListScanDefinitionsQueryDto,
  type UpdateScanDefinitionDto,
} from "./scan-center.dto.js";
import { SCAN_CENTER_MODULE_KEY } from "./scan-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ScanDefinitionsService } from "./scan-definitions.service.js";

type ScanCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

/** `@RequirePermission` is placed on every individual method, never at class level —
 *  `PermissionGuard` only reads `context.getHandler()` (a deliberate fail-closed design). `:projectId`
 *  is a real route path parameter, not a query/body field, mirroring `InternalLinksController`'s
 *  own shape exactly. No status/workflow route here — definitions have no workflow of their own. */
@ApiTags("scan-center")
@Controller("scan-center/projects/:projectId/definitions")
@UseGuards(SessionGuard)
export class ScanDefinitionsController {
  constructor(private readonly definitions: ScanDefinitionsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(SCAN_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "List scan definitions for a project, optionally filtered" })
  async list(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Query(new ZodValidationPipe(listScanDefinitionsQuerySchema))
    query: ListScanDefinitionsQueryDto,
    @Req() req: ScanCenterRequest,
  ): Promise<ApiSuccessResponse<readonly ScanDefinitionEntity[]>> {
    const data = await this.definitions.list({ ...query, projectId });
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(SCAN_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one scan definition" })
  async findOne(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ScanCenterRequest,
  ): Promise<ApiSuccessResponse<ScanDefinitionEntity>> {
    const data = await this.definitions.findById(id, projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(SCAN_CENTER_MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a scan definition" })
  async create(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Body(new ZodValidationPipe(createScanDefinitionSchema)) body: CreateScanDefinitionDto,
    @Req() req: ScanCenterRequest,
  ): Promise<ApiSuccessResponse<ScanDefinitionEntity>> {
    const data = await this.definitions.create(projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(SCAN_CENTER_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Edit a scan definition" })
  async update(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateScanDefinitionSchema)) body: UpdateScanDefinitionDto,
    @Req() req: ScanCenterRequest,
  ): Promise<ApiSuccessResponse<ScanDefinitionEntity>> {
    const data = await this.definitions.update(id, projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
