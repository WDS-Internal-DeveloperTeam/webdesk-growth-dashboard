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
import type { ContentTemplateEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeContentTemplateApprovalStatusSchema,
  createContentTemplateSchema,
  listContentTemplatesQuerySchema,
  updateContentTemplateSchema,
  type ChangeContentTemplateApprovalStatusDto,
  type CreateContentTemplateDto,
  type ListContentTemplatesQueryDto,
  type UpdateContentTemplateDto,
} from "./content-template-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ContentTemplatesService } from "./content-templates.service.js";

type ContentTemplateLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

// The real, seeded RBAC permission group for this module (task package §0) — this module is the
// first real consumer of both this group and the real, previously-unused `publish`/`unpublish`
// RBAC actions (00013-seed-rbac-matrix.ts:127-135).
const MODULE_KEY = "page_content";

@ApiTags("content-template-library")
@Controller("content-template-library/templates")
@UseGuards(SessionGuard)
export class ContentTemplatesController {
  constructor(private readonly templates: ContentTemplatesService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List content templates, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listContentTemplatesQuerySchema))
    query: ListContentTemplatesQueryDto,
    @Req() req: ContentTemplateLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly ContentTemplateEntity[]>> {
    const data = await this.templates.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one content template" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ContentTemplateLibraryRequest,
  ): Promise<ApiSuccessResponse<ContentTemplateEntity>> {
    const data = await this.templates.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a content template (always starts draft, unpublished)" })
  async create(
    @Body(new ZodValidationPipe(createContentTemplateSchema)) body: CreateContentTemplateDto,
    @Req() req: ContentTemplateLibraryRequest,
  ): Promise<ApiSuccessResponse<ContentTemplateEntity>> {
    const data = await this.templates.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({
    summary:
      "Edit a content template's content fields (increments version, never touches " +
      "approvalStatus/isPublished/publishedAt)",
  })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateContentTemplateSchema)) body: UpdateContentTemplateDto,
    @Req() req: ContentTemplateLibraryRequest,
  ): Promise<ApiSuccessResponse<ContentTemplateEntity>> {
    const data = await this.templates.update(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve) and is checked dynamically inside the service itself, the same
  // layered pattern personas.controller.ts's/services.controller.ts's own status route already
  // established. PermissionGuard still runs (via @UseGuards below) checking only module `view`,
  // so a caller with no access to this module at all is still rejected at the route.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a content template's approval status" })
  async changeStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeContentTemplateApprovalStatusSchema))
    body: ChangeContentTemplateApprovalStatusDto,
    @Req() req: ContentTemplateLibraryRequest,
  ): Promise<ApiSuccessResponse<ContentTemplateEntity>> {
    const data = await this.templates.changeApprovalStatus(
      id,
      body.approvalStatus,
      req.authUser!.id,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/publish")
  @HttpCode(HttpStatus.OK)
  // Same layered pattern as the status route above — the real gate is the "publish" action,
  // checked dynamically inside the service (which also enforces the approvalStatus === "approved"
  // business rule, D2) rather than a static @RequirePermission("publish") here, so the service's
  // own 400/404/409 outcomes are reachable before/instead of a blanket 403. PermissionGuard still
  // runs checking only module `view`.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Publish an approved content template" })
  async publish(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ContentTemplateLibraryRequest,
  ): Promise<ApiSuccessResponse<ContentTemplateEntity>> {
    const data = await this.templates.publish(id, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/unpublish")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Unpublish a content template (allowed regardless of approvalStatus)" })
  async unpublish(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ContentTemplateLibraryRequest,
  ): Promise<ApiSuccessResponse<ContentTemplateEntity>> {
    const data = await this.templates.unpublish(id, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
