import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ImportTemplateEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createImportTemplateSchema,
  listImportTemplatesQuerySchema,
  updateImportTemplateSchema,
  type CreateImportTemplateDto,
  type ListImportTemplatesQueryDto,
  type UpdateImportTemplateDto,
} from "./import-and-export-center.dto.js";
import { IMPORTS_MODULE_KEY } from "./import-and-export-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ImportTemplatesService } from "./import-templates.service.js";

type ImportAndExportCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("import-and-export-center")
@Controller("import-and-export-center/templates")
@UseGuards(SessionGuard)
export class ImportTemplatesController {
  constructor(private readonly templates: ImportTemplatesService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(IMPORTS_MODULE_KEY, "view")
  @ApiOperation({ summary: "List import templates, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listImportTemplatesQuerySchema))
    query: ListImportTemplatesQueryDto,
    @Req() req: ImportAndExportCenterRequest,
  ): Promise<ApiSuccessResponse<readonly ImportTemplateEntity[]>> {
    const data = await this.templates.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(IMPORTS_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one import template" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ImportAndExportCenterRequest,
  ): Promise<ApiSuccessResponse<ImportTemplateEntity>> {
    const data = await this.templates.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(IMPORTS_MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a reusable import template" })
  async create(
    @Body(new ZodValidationPipe(createImportTemplateSchema)) body: CreateImportTemplateDto,
    @Req() req: ImportAndExportCenterRequest,
  ): Promise<ApiSuccessResponse<ImportTemplateEntity>> {
    const data = await this.templates.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(IMPORTS_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Update an import template's content" })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateImportTemplateSchema)) body: UpdateImportTemplateDto,
    @Req() req: ImportAndExportCenterRequest,
  ): Promise<ApiSuccessResponse<ImportTemplateEntity>> {
    const data = await this.templates.update(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
