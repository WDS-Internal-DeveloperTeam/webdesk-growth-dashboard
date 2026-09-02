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
import type { ImportRunEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeImportRunStatusSchema,
  createImportRunSchema,
  listImportRunsQuerySchema,
  type ChangeImportRunStatusDto,
  type CreateImportRunDto,
  type ListImportRunsQueryDto,
} from "./import-and-export-center.dto.js";
import { IMPORTS_MODULE_KEY } from "./import-and-export-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ImportRunsService } from "./import-runs.service.js";

type ImportAndExportCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("import-and-export-center")
@Controller("import-and-export-center/runs")
@UseGuards(SessionGuard)
export class ImportRunsController {
  constructor(private readonly runs: ImportRunsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(IMPORTS_MODULE_KEY, "view")
  @ApiOperation({ summary: "List import runs, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listImportRunsQuerySchema)) query: ListImportRunsQueryDto,
    @Req() req: ImportAndExportCenterRequest,
  ): Promise<ApiSuccessResponse<readonly ImportRunEntity[]>> {
    const data = await this.runs.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(IMPORTS_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one import run" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ImportAndExportCenterRequest,
  ): Promise<ApiSuccessResponse<ImportRunEntity>> {
    const data = await this.runs.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(IMPORTS_MODULE_KEY, "create")
  @ApiOperation({ summary: "Create (draft) an import run against an active import template" })
  async create(
    @Body(new ZodValidationPipe(createImportRunSchema)) body: CreateImportRunDto,
    @Req() req: ImportAndExportCenterRequest,
  ): Promise<ApiSuccessResponse<ImportRunEntity>> {
    const data = await this.runs.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission(<static action>) here at the class-level route gate — the real gate
  // varies by transition (submit/review/approve/edit), checked dynamically inside the service
  // (mirrors ReviewsController's/ChangeRecordsController's own layered pattern). PermissionGuard
  // still runs (via @UseGuards below) checking the weaker "view" action, so a caller with no
  // access to this module at all is still rejected at the route.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(IMPORTS_MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition an import run's status" })
  async changeStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeImportRunStatusSchema)) body: ChangeImportRunStatusDto,
    @Req() req: ImportAndExportCenterRequest,
  ): Promise<ApiSuccessResponse<ImportRunEntity>> {
    const data = await this.runs.changeStatus(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
