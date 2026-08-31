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
import type { SectionPatternRecordEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import { MODULE_KEY } from "./section-and-pattern-library.constants.js";
import {
  changeSectionPatternApprovalStatusSchema,
  createSectionPatternRecordSchema,
  listSectionPatternRecordsQuerySchema,
  updateSectionPatternRecordSchema,
  type ChangeSectionPatternApprovalStatusDto,
  type CreateSectionPatternRecordDto,
  type ListSectionPatternRecordsQueryDto,
  type UpdateSectionPatternRecordDto,
} from "./section-and-pattern-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { SectionPatternsService } from "./section-patterns.service.js";

type SectionAndPatternLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("section-and-pattern-library")
@Controller("section-and-pattern-library/records")
@UseGuards(SessionGuard)
export class SectionPatternsController {
  constructor(private readonly patterns: SectionPatternsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List section/pattern records (current versions only)" })
  async list(
    @Query(new ZodValidationPipe(listSectionPatternRecordsQuerySchema))
    query: ListSectionPatternRecordsQueryDto,
    @Req() req: SectionAndPatternLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly SectionPatternRecordEntity[]>> {
    const data = await this.patterns.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":recordId")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get the current version of one section/pattern record" })
  async findOne(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Req() req: SectionAndPatternLibraryRequest,
  ): Promise<ApiSuccessResponse<SectionPatternRecordEntity>> {
    const data = await this.patterns.findCurrent(recordId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":recordId/versions")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get the full version history of one section/pattern record" })
  async versions(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Req() req: SectionAndPatternLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly SectionPatternRecordEntity[]>> {
    const data = await this.patterns.listVersions(recordId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a section/pattern record (always starts draft, version 1)" })
  async create(
    @Body(new ZodValidationPipe(createSectionPatternRecordSchema))
    body: CreateSectionPatternRecordDto,
    @Req() req: SectionAndPatternLibraryRequest,
  ): Promise<ApiSuccessResponse<SectionPatternRecordEntity>> {
    const data = await this.patterns.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":recordId/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({
    summary:
      "Edit a section/pattern record's fields — mutates the current version in place if it " +
      "isn't approved yet, otherwise creates a new draft version",
  })
  async update(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Body(new ZodValidationPipe(updateSectionPatternRecordSchema))
    body: UpdateSectionPatternRecordDto,
    @Req() req: SectionAndPatternLibraryRequest,
  ): Promise<ApiSuccessResponse<SectionPatternRecordEntity>> {
    const data = await this.patterns.update(recordId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":recordId/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve) and is checked dynamically inside the service itself, the same
  // layered pattern design-tokens.controller.ts's/website-strategy-records.controller.ts's/
  // claims.controller.ts's own status route already established. PermissionGuard still runs (via
  // @UseGuards below) checking only module `view`, so a caller with no access to this module at
  // all is still rejected at the route. A successful "-> approved" transition additionally,
  // atomically, supersedes the record's previously-current-approved version, if one exists.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a section/pattern record's approval status" })
  async changeStatus(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Body(new ZodValidationPipe(changeSectionPatternApprovalStatusSchema))
    body: ChangeSectionPatternApprovalStatusDto,
    @Req() req: SectionAndPatternLibraryRequest,
  ): Promise<ApiSuccessResponse<SectionPatternRecordEntity>> {
    const data = await this.patterns.changeApprovalStatus(
      recordId,
      body.approvalStatus,
      req.authUser!.id,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
