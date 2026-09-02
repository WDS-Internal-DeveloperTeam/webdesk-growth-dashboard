import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ImportRowEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  listImportRowsQuerySchema,
  type ListImportRowsQueryDto,
} from "./import-and-export-center.dto.js";
import { IMPORTS_MODULE_KEY } from "./import-and-export-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ImportRowsService } from "./import-rows.service.js";

type ImportAndExportCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

/** Read-only — there is no standalone create/update route for `import_rows` (rows are bulk-
 *  created only as a side effect of `POST .../runs/:runId/status`). `@RequirePermission` is
 *  declared on each method individually, never at the class level — `PermissionGuard` only ever
 *  reads `context.getHandler()`, so a class-level decorator would silently fail open. */
@ApiTags("import-and-export-center")
@Controller("import-and-export-center/runs/:runId/rows")
@UseGuards(SessionGuard)
export class ImportRowsController {
  constructor(private readonly rows: ImportRowsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(IMPORTS_MODULE_KEY, "view")
  @ApiOperation({ summary: "List a run's own rows, optionally filtered by status" })
  async list(
    @Param("runId", new ParseUUIDPipe()) runId: string,
    @Query(new ZodValidationPipe(listImportRowsQuerySchema)) query: ListImportRowsQueryDto,
    @Req() req: ImportAndExportCenterRequest,
  ): Promise<ApiSuccessResponse<readonly ImportRowEntity[]>> {
    const data = await this.rows.list({ ...query, importRunId: runId });
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(IMPORTS_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one import row" })
  async findOne(
    @Param("runId", new ParseUUIDPipe()) runId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ImportAndExportCenterRequest,
  ): Promise<ApiSuccessResponse<ImportRowEntity>> {
    const data = await this.rows.findById(id, runId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
