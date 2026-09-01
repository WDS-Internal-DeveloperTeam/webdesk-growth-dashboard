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
import type { CaseStudyApprovalEntity, CaseStudyEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeCaseStudyStatusSchema,
  createCaseStudySchema,
  listCaseStudiesQuerySchema,
  updateCaseStudySchema,
  type ChangeCaseStudyStatusDto,
  type CreateCaseStudyDto,
  type ListCaseStudiesQueryDto,
  type UpdateCaseStudyDto,
} from "./case-study-studio.dto.js";
import { CASE_STUDY_STUDIO_MODULE_KEY } from "./case-study-studio.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { CaseStudiesService } from "./case-studies.service.js";

type CaseStudyStudioRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("case-study-studio")
@Controller("case-study-studio/case-studies")
@UseGuards(SessionGuard)
export class CaseStudiesController {
  constructor(private readonly caseStudies: CaseStudiesService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(CASE_STUDY_STUDIO_MODULE_KEY, "view")
  @ApiOperation({ summary: "List case studies, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listCaseStudiesQuerySchema)) query: ListCaseStudiesQueryDto,
    @Req() req: CaseStudyStudioRequest,
  ): Promise<ApiSuccessResponse<readonly CaseStudyEntity[]>> {
    const data = await this.caseStudies.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(CASE_STUDY_STUDIO_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one case study" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: CaseStudyStudioRequest,
  ): Promise<ApiSuccessResponse<CaseStudyEntity>> {
    const data = await this.caseStudies.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id/approvals")
  @UseGuards(PermissionGuard)
  @RequirePermission(CASE_STUDY_STUDIO_MODULE_KEY, "view")
  @ApiOperation({ summary: "List a case study's approval decision history" })
  async listApprovals(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: CaseStudyStudioRequest,
  ): Promise<ApiSuccessResponse<readonly CaseStudyApprovalEntity[]>> {
    const data = await this.caseStudies.listApprovals(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(CASE_STUDY_STUDIO_MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a case study (always starts intake)" })
  async create(
    @Body(new ZodValidationPipe(createCaseStudySchema)) body: CreateCaseStudyDto,
    @Req() req: CaseStudyStudioRequest,
  ): Promise<ApiSuccessResponse<CaseStudyEntity>> {
    const data = await this.caseStudies.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(CASE_STUDY_STUDIO_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Edit a case study's content fields (never touches status)" })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateCaseStudySchema)) body: UpdateCaseStudyDto,
    @Req() req: CaseStudyStudioRequest,
  ): Promise<ApiSuccessResponse<CaseStudyEntity>> {
    const data = await this.caseStudies.update(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve/publish/unpublish) and is checked dynamically inside the service
  // itself, the same layered pattern claims.controller.ts's/services.controller.ts's own status
  // route already established. PermissionGuard still runs (via @UseGuards below) checking only
  // module `view`, so a caller with no access to this module at all is still rejected at the
  // route.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(CASE_STUDY_STUDIO_MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a case study's status" })
  async changeStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeCaseStudyStatusSchema)) body: ChangeCaseStudyStatusDto,
    @Req() req: CaseStudyStudioRequest,
  ): Promise<ApiSuccessResponse<CaseStudyEntity>> {
    const data = await this.caseStudies.changeStatus(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
