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
import type { ExportRunEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeExportRunStatusSchema,
  createExportRunSchema,
  listExportRunsQuerySchema,
  type ChangeExportRunStatusDto,
  type CreateExportRunDto,
  type ListExportRunsQueryDto,
} from "./import-and-export-center.dto.js";
import { EXPORTS_MODULE_KEY } from "./import-and-export-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ExportRunsService } from "./export-runs.service.js";

type ImportAndExportCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

/** Gated on the `exports` RBAC group throughout — no `create` letter exists in that group's own
 *  seeded action set, since creating an export run IS the `export` action
 *  (`import-and-export-center.constants.ts`'s own doc comment). */
@ApiTags("import-and-export-center")
@Controller("import-and-export-center/exports")
@UseGuards(SessionGuard)
export class ExportRunsController {
  constructor(private readonly exports: ExportRunsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(EXPORTS_MODULE_KEY, "view")
  @ApiOperation({ summary: "List export runs, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listExportRunsQuerySchema)) query: ListExportRunsQueryDto,
    @Req() req: ImportAndExportCenterRequest,
  ): Promise<ApiSuccessResponse<readonly ExportRunEntity[]>> {
    const data = await this.exports.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(EXPORTS_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one export run" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ImportAndExportCenterRequest,
  ): Promise<ApiSuccessResponse<ExportRunEntity>> {
    const data = await this.exports.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(EXPORTS_MODULE_KEY, "export")
  @ApiOperation({ summary: "Create (request) an export run" })
  async create(
    @Body(new ZodValidationPipe(createExportRunSchema)) body: CreateExportRunDto,
    @Req() req: ImportAndExportCenterRequest,
  ): Promise<ApiSuccessResponse<ExportRunEntity>> {
    const data = await this.exports.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(EXPORTS_MODULE_KEY, "export")
  @ApiOperation({ summary: "Transition an export run's status" })
  async changeStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeExportRunStatusSchema)) body: ChangeExportRunStatusDto,
    @Req() req: ImportAndExportCenterRequest,
  ): Promise<ApiSuccessResponse<ExportRunEntity>> {
    const data = await this.exports.changeStatus(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
