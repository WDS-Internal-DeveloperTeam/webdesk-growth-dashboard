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
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createCaseStudyLibraryRecordSchema,
  listCaseStudyLibraryRecordsQuerySchema,
  updateCaseStudyLibraryRecordSchema,
  type CreateCaseStudyLibraryRecordDto,
  type ListCaseStudyLibraryRecordsQueryDto,
  type UpdateCaseStudyLibraryRecordDto,
} from "./case-study-library.dto.js";
import { CASE_STUDY_STUDIO_MODULE_KEY } from "./case-study-library.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import {
  CaseStudyLibraryService,
  type CaseStudyLibraryRecordWithCaseStudy,
} from "./case-study-library.service.js";

type CaseStudyLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

/** No delete route — the real, seeded `case_studies` RBAC permission group has no delete action
 *  (`06_Roles_and_Permissions.md`, `00013-seed-rbac-matrix.ts:163-171`), and no status-transition
 *  route — this record has no independent lifecycle of its own (D1). */
@ApiTags("case-study-library")
@Controller("case-study-library/records")
@UseGuards(SessionGuard)
export class CaseStudyLibraryController {
  constructor(private readonly records: CaseStudyLibraryService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(CASE_STUDY_STUDIO_MODULE_KEY, "view")
  @ApiOperation({
    summary: "List case study library records, each joined with its parent case study",
  })
  async list(
    @Query(new ZodValidationPipe(listCaseStudyLibraryRecordsQuerySchema))
    query: ListCaseStudyLibraryRecordsQueryDto,
    @Req() req: CaseStudyLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly CaseStudyLibraryRecordWithCaseStudy[]>> {
    const data = await this.records.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(CASE_STUDY_STUDIO_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one case study library record, joined with its parent case study" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: CaseStudyLibraryRequest,
  ): Promise<ApiSuccessResponse<CaseStudyLibraryRecordWithCaseStudy>> {
    const data = await this.records.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(CASE_STUDY_STUDIO_MODULE_KEY, "create")
  @ApiOperation({
    summary:
      "Create a library record for a published/unpublished/archived case study (one per case study)",
  })
  async create(
    @Body(new ZodValidationPipe(createCaseStudyLibraryRecordSchema))
    body: CreateCaseStudyLibraryRecordDto,
    @Req() req: CaseStudyLibraryRequest,
  ): Promise<ApiSuccessResponse<CaseStudyLibraryRecordWithCaseStudy>> {
    const data = await this.records.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(CASE_STUDY_STUDIO_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Edit a library record's extension fields" })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateCaseStudyLibraryRecordSchema))
    body: UpdateCaseStudyLibraryRecordDto,
    @Req() req: CaseStudyLibraryRequest,
  ): Promise<ApiSuccessResponse<CaseStudyLibraryRecordWithCaseStudy>> {
    const data = await this.records.update(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
