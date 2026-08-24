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
import type { KeywordEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeKeywordApprovalStatusSchema,
  createKeywordSchema,
  listKeywordsQuerySchema,
  updateKeywordSchema,
  type ChangeKeywordApprovalStatusDto,
  type CreateKeywordDto,
  type ListKeywordsQueryDto,
  type UpdateKeywordDto,
} from "./keyword-and-entity-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { KeywordsService } from "./keywords.service.js";

type KeywordLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

const MODULE_KEY = "keyword_internal_links";

/** `@RequirePermission` is placed on every individual method, never at class level —
 *  `PermissionGuard` only reads `context.getHandler()` (a deliberate fail-closed design), the
 *  exact bug 3+ prior modules in this codebase independently had and fixed once already
 *  (Service Library's dimensions controller, most recently repeated and re-fixed on Page
 *  Inventory's own `:projectId`-path restructuring).
 *
 *  `:projectId` is a real route path parameter, not a query/body field — `PermissionGuard` only
 *  ever reads `request.params?.projectId`, so a caller holding only a project-scoped
 *  `keyword_internal_links` grant (not a global one) would otherwise be silently denied on every
 *  route, the exact gap Page Inventory's own code review found and fixed once already. Mirrors
 *  `PagesController`'s own `page-inventory/projects/:projectId/pages` shape exactly. */
@ApiTags("keyword-and-entity-library")
@Controller("keyword-and-entity-library/projects/:projectId/keywords")
@UseGuards(SessionGuard)
export class KeywordsController {
  constructor(private readonly keywords: KeywordsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List keywords for a project, optionally filtered" })
  async list(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Query(new ZodValidationPipe(listKeywordsQuerySchema)) query: ListKeywordsQueryDto,
    @Req() req: KeywordLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly KeywordEntity[]>> {
    const data = await this.keywords.list({ ...query, projectId });
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one keyword" })
  async findOne(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: KeywordLibraryRequest,
  ): Promise<ApiSuccessResponse<KeywordEntity>> {
    const data = await this.keywords.findById(id, projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a keyword (always starts draft)" })
  async create(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Body(new ZodValidationPipe(createKeywordSchema)) body: CreateKeywordDto,
    @Req() req: KeywordLibraryRequest,
  ): Promise<ApiSuccessResponse<KeywordEntity>> {
    const data = await this.keywords.create(projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Edit a keyword's content fields (never touches approvalStatus)" })
  async update(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateKeywordSchema)) body: UpdateKeywordDto,
    @Req() req: KeywordLibraryRequest,
  ): Promise<ApiSuccessResponse<KeywordEntity>> {
    const data = await this.keywords.update(id, projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve) and is checked dynamically inside the service itself, the same
  // layered pattern pages.controller.ts's/claims.controller.ts's/personas.controller.ts's own
  // status route already established. PermissionGuard still runs (via @UseGuards below) checking
  // only module `view`, so a caller with no access to this module at all is still rejected at the
  // route.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a keyword's approval status" })
  async changeApprovalStatus(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeKeywordApprovalStatusSchema))
    body: ChangeKeywordApprovalStatusDto,
    @Req() req: KeywordLibraryRequest,
  ): Promise<ApiSuccessResponse<KeywordEntity>> {
    const data = await this.keywords.changeApprovalStatus(
      id,
      projectId,
      body.approvalStatus,
      req.authUser!.id,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
