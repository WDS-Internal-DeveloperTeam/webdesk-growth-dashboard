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
import type { PageTemplateEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import { MODULE_KEY } from "./page-template-library.constants.js";
import {
  changePageTemplateApprovalStatusSchema,
  createPageTemplateSchema,
  listPageTemplatesQuerySchema,
  updatePageTemplateSchema,
  type ChangePageTemplateApprovalStatusDto,
  type CreatePageTemplateDto,
  type ListPageTemplatesQueryDto,
  type UpdatePageTemplateDto,
} from "./page-template-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { PageTemplatesService } from "./page-templates.service.js";

type PageTemplateLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("page-template-library")
@Controller("page-template-library/page-templates")
@UseGuards(SessionGuard)
export class PageTemplatesController {
  constructor(private readonly pageTemplates: PageTemplatesService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List page templates (current versions only)" })
  async list(
    @Query(new ZodValidationPipe(listPageTemplatesQuerySchema))
    query: ListPageTemplatesQueryDto,
    @Req() req: PageTemplateLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly PageTemplateEntity[]>> {
    const data = await this.pageTemplates.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":recordId")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get the current version of one page template" })
  async findOne(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Req() req: PageTemplateLibraryRequest,
  ): Promise<ApiSuccessResponse<PageTemplateEntity>> {
    const data = await this.pageTemplates.findCurrent(recordId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":recordId/versions")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get the full version history of one page template" })
  async versions(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Req() req: PageTemplateLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly PageTemplateEntity[]>> {
    const data = await this.pageTemplates.listVersions(recordId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a page template (always starts draft, version 1)" })
  async create(
    @Body(new ZodValidationPipe(createPageTemplateSchema))
    body: CreatePageTemplateDto,
    @Req() req: PageTemplateLibraryRequest,
  ): Promise<ApiSuccessResponse<PageTemplateEntity>> {
    const data = await this.pageTemplates.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":recordId/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({
    summary:
      "Edit a page template's fields — mutates the current version in place if it isn't " +
      "approved yet, otherwise creates a new draft version",
  })
  async update(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Body(new ZodValidationPipe(updatePageTemplateSchema))
    body: UpdatePageTemplateDto,
    @Req() req: PageTemplateLibraryRequest,
  ): Promise<ApiSuccessResponse<PageTemplateEntity>> {
    const data = await this.pageTemplates.update(recordId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":recordId/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve) and is checked dynamically inside the service itself, the same
  // layered pattern component-library.controller.ts's/design-tokens.controller.ts's/
  // section-patterns.controller.ts's own status route already established. PermissionGuard still
  // runs (via @UseGuards below) checking only module `view`, so a caller with no access to this
  // module at all is still rejected at the route. A successful "-> approved" transition
  // additionally, atomically, supersedes the record's previously-current-approved version, if one
  // exists.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a page template's approval status" })
  async changeStatus(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Body(new ZodValidationPipe(changePageTemplateApprovalStatusSchema))
    body: ChangePageTemplateApprovalStatusDto,
    @Req() req: PageTemplateLibraryRequest,
  ): Promise<ApiSuccessResponse<PageTemplateEntity>> {
    const data = await this.pageTemplates.changeApprovalStatus(
      recordId,
      body.approvalStatus,
      req.authUser!.id,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
