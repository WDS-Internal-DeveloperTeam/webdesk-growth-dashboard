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
import type { CaseStudyAssetEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createCaseStudyAssetSchema,
  updateCaseStudyAssetSchema,
  type CreateCaseStudyAssetDto,
  type UpdateCaseStudyAssetDto,
} from "./case-study-studio.dto.js";
import { CASE_STUDY_STUDIO_MODULE_KEY } from "./case-study-studio.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { CaseStudyAssetsService } from "./case-study-assets.service.js";

type CaseStudyStudioRequest = AuthenticatedRequest & RequestWithCorrelationId;

/** Assets aren't independently governed by the parent case study's status workflow — gated on the
 *  same `MODULE_KEY` with `view`/`edit` actions, mirroring `ClaimSourcesController`'s own
 *  sub-resource gating pattern. */
@ApiTags("case-study-studio")
@Controller("case-study-studio/case-studies/:caseStudyId/assets")
@UseGuards(SessionGuard)
export class CaseStudyAssetsController {
  constructor(private readonly caseStudyAssets: CaseStudyAssetsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(CASE_STUDY_STUDIO_MODULE_KEY, "view")
  @ApiOperation({ summary: "List a case study's linked assets" })
  async list(
    @Param("caseStudyId", new ParseUUIDPipe()) caseStudyId: string,
    @Req() req: CaseStudyStudioRequest,
  ): Promise<ApiSuccessResponse<readonly CaseStudyAssetEntity[]>> {
    const data = await this.caseStudyAssets.listByCaseStudy(caseStudyId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(CASE_STUDY_STUDIO_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Link an asset to a case study" })
  async create(
    @Param("caseStudyId", new ParseUUIDPipe()) caseStudyId: string,
    @Body(new ZodValidationPipe(createCaseStudyAssetSchema)) body: CreateCaseStudyAssetDto,
    @Req() req: CaseStudyStudioRequest,
  ): Promise<ApiSuccessResponse<CaseStudyAssetEntity>> {
    const data = await this.caseStudyAssets.create(caseStudyId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(CASE_STUDY_STUDIO_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Update a case study's linked asset" })
  async update(
    @Param("caseStudyId", new ParseUUIDPipe()) caseStudyId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateCaseStudyAssetSchema)) body: UpdateCaseStudyAssetDto,
    @Req() req: CaseStudyStudioRequest,
  ): Promise<ApiSuccessResponse<CaseStudyAssetEntity>> {
    const data = await this.caseStudyAssets.update(id, caseStudyId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(CASE_STUDY_STUDIO_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Unlink an asset from a case study" })
  async remove(
    @Param("caseStudyId", new ParseUUIDPipe()) caseStudyId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: CaseStudyStudioRequest,
  ): Promise<void> {
    await this.caseStudyAssets.remove(id, caseStudyId, req.authUser!.id);
  }
}
