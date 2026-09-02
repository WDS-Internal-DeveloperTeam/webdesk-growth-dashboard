import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ImportErrorEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  listImportErrorsQuerySchema,
  type ListImportErrorsQueryDto,
} from "./import-and-export-center.dto.js";
import { IMPORTS_MODULE_KEY } from "./import-and-export-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ImportErrorsService } from "./import-errors.service.js";

type ImportAndExportCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

/** Read-only, immutable (ADR-0016) — no create/update/delete route exists for `import_errors`.
 *  `@RequirePermission` is declared on each method individually, never at the class level. */
@ApiTags("import-and-export-center")
@Controller("import-and-export-center/runs/:runId/errors")
@UseGuards(SessionGuard)
export class ImportErrorsController {
  constructor(private readonly errors: ImportErrorsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(IMPORTS_MODULE_KEY, "view")
  @ApiOperation({ summary: "List a run's own errors" })
  async list(
    @Param("runId", new ParseUUIDPipe()) runId: string,
    @Query(new ZodValidationPipe(listImportErrorsQuerySchema)) query: ListImportErrorsQueryDto,
    @Req() req: ImportAndExportCenterRequest,
  ): Promise<ApiSuccessResponse<readonly ImportErrorEntity[]>> {
    const data = await this.errors.list({ ...query, importRunId: runId });
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(IMPORTS_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one import error" })
  async findOne(
    @Param("runId", new ParseUUIDPipe()) runId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ImportAndExportCenterRequest,
  ): Promise<ApiSuccessResponse<ImportErrorEntity>> {
    const data = await this.errors.findById(id, runId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
