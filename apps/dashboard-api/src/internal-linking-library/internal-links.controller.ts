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
import type { InternalLinkEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeInternalLinkStatusSchema,
  createInternalLinkSchema,
  listInternalLinksQuerySchema,
  updateInternalLinkSchema,
  type ChangeInternalLinkStatusDto,
  type CreateInternalLinkDto,
  type ListInternalLinksQueryDto,
  type UpdateInternalLinkDto,
} from "./internal-linking-library.dto.js";
import { INTERNAL_LINKING_LIBRARY_MODULE_KEY } from "./internal-linking-library.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { InternalLinksService } from "./internal-links.service.js";

type InternalLinkingLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

/** `@RequirePermission` is placed on every individual method, never at class level —
 *  `PermissionGuard` only reads `context.getHandler()` (a deliberate fail-closed design), the
 *  exact bug 3+ prior modules in this codebase independently had and fixed once already.
 *
 *  `:projectId` is a real route path parameter, not a query/body field — `PermissionGuard` only
 *  ever reads `request.params?.projectId`, so a caller holding only a project-scoped
 *  `keyword_internal_links` grant (not a global one) would otherwise be silently denied on every
 *  route. Mirrors `KeywordsController`'s own
 *  `keyword-and-entity-library/projects/:projectId/keywords` shape exactly. */
@ApiTags("internal-linking-library")
@Controller("internal-linking-library/projects/:projectId/links")
@UseGuards(SessionGuard)
export class InternalLinksController {
  constructor(private readonly links: InternalLinksService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(INTERNAL_LINKING_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "List internal links for a project, optionally filtered" })
  async list(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Query(new ZodValidationPipe(listInternalLinksQuerySchema)) query: ListInternalLinksQueryDto,
    @Req() req: InternalLinkingLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly InternalLinkEntity[]>> {
    const data = await this.links.list({ ...query, projectId });
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(INTERNAL_LINKING_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one internal link" })
  async findOne(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: InternalLinkingLibraryRequest,
  ): Promise<ApiSuccessResponse<InternalLinkEntity>> {
    const data = await this.links.findById(id, projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(INTERNAL_LINKING_LIBRARY_MODULE_KEY, "create")
  @ApiOperation({ summary: "Create an internal link (always starts proposed)" })
  async create(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Body(new ZodValidationPipe(createInternalLinkSchema)) body: CreateInternalLinkDto,
    @Req() req: InternalLinkingLibraryRequest,
  ): Promise<ApiSuccessResponse<InternalLinkEntity>> {
    const data = await this.links.create(projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(INTERNAL_LINKING_LIBRARY_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Edit an internal link's content fields (never touches status)" })
  async update(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateInternalLinkSchema)) body: UpdateInternalLinkDto,
    @Req() req: InternalLinkingLibraryRequest,
  ): Promise<ApiSuccessResponse<InternalLinkEntity>> {
    const data = await this.links.update(id, projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve) and is checked dynamically inside the service itself, the same
  // layered pattern keywords.controller.ts's/pages.controller.ts's own status route already
  // established. PermissionGuard still runs (via @UseGuards below) checking only module `view`,
  // so a caller with no access to this module at all is still rejected at the route.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(INTERNAL_LINKING_LIBRARY_MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition an internal link's status" })
  async changeStatus(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeInternalLinkStatusSchema))
    body: ChangeInternalLinkStatusDto,
    @Req() req: InternalLinkingLibraryRequest,
  ): Promise<ApiSuccessResponse<InternalLinkEntity>> {
    const data = await this.links.changeStatus(id, projectId, body.status, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
