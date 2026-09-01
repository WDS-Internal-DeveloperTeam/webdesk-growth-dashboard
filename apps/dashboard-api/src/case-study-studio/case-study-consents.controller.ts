import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { CaseStudyConsentEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createCaseStudyConsentSchema,
  updateCaseStudyConsentSchema,
  type CreateCaseStudyConsentDto,
  type UpdateCaseStudyConsentDto,
} from "./case-study-studio.dto.js";
import { CASE_STUDY_STUDIO_MODULE_KEY } from "./case-study-studio.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { CaseStudyConsentsService } from "./case-study-consents.service.js";

type CaseStudyStudioRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("case-study-studio")
@Controller("case-study-studio/case-studies/:caseStudyId/consents")
@UseGuards(SessionGuard)
export class CaseStudyConsentsController {
  constructor(private readonly caseStudyConsents: CaseStudyConsentsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(CASE_STUDY_STUDIO_MODULE_KEY, "view")
  @ApiOperation({ summary: "List a case study's consent records" })
  async list(
    @Param("caseStudyId", new ParseUUIDPipe()) caseStudyId: string,
    @Req() req: CaseStudyStudioRequest,
  ): Promise<ApiSuccessResponse<readonly CaseStudyConsentEntity[]>> {
    const data = await this.caseStudyConsents.listByCaseStudy(caseStudyId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(CASE_STUDY_STUDIO_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Add a consent record to a case study" })
  async create(
    @Param("caseStudyId", new ParseUUIDPipe()) caseStudyId: string,
    @Body(new ZodValidationPipe(createCaseStudyConsentSchema)) body: CreateCaseStudyConsentDto,
    @Req() req: CaseStudyStudioRequest,
  ): Promise<ApiSuccessResponse<CaseStudyConsentEntity>> {
    const data = await this.caseStudyConsents.create(caseStudyId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(CASE_STUDY_STUDIO_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Update a case study consent record" })
  async update(
    @Param("caseStudyId", new ParseUUIDPipe()) caseStudyId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateCaseStudyConsentSchema)) body: UpdateCaseStudyConsentDto,
    @Req() req: CaseStudyStudioRequest,
  ): Promise<ApiSuccessResponse<CaseStudyConsentEntity>> {
    const data = await this.caseStudyConsents.update(id, caseStudyId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(CASE_STUDY_STUDIO_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Remove a case study consent record" })
  async remove(
    @Param("caseStudyId", new ParseUUIDPipe()) caseStudyId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: CaseStudyStudioRequest,
  ): Promise<void> {
    await this.caseStudyConsents.remove(id, caseStudyId, req.authUser!.id);
  }
}
