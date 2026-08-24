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
import type { PageKeywordAssignmentEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createPageKeywordAssignmentSchema,
  type CreatePageKeywordAssignmentDto,
} from "./keyword-and-entity-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { PageKeywordAssignmentsService } from "./page-keyword-assignments.service.js";

type KeywordLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

const MODULE_KEY = "keyword_internal_links";

/** No separate approval workflow for assignments (task package D9) — gated on the same
 *  `MODULE_KEY` with `view`/`edit` actions, mirroring `KeywordEntityRelationshipsController`'s own
 *  sub-resource gating pattern. `@RequirePermission` is placed on every individual method, never
 *  at class level, same discipline as `KeywordsController`. */
@ApiTags("keyword-and-entity-library")
@Controller("keyword-and-entity-library/projects/:projectId/keywords/:keywordId/page-assignments")
@UseGuards(SessionGuard)
export class PageKeywordAssignmentsController {
  constructor(private readonly assignments: PageKeywordAssignmentsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List a keyword's assigned pages" })
  async list(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("keywordId", new ParseUUIDPipe()) keywordId: string,
    @Req() req: KeywordLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly PageKeywordAssignmentEntity[]>> {
    const data = await this.assignments.listForKeyword(keywordId, projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Assign a keyword to a Page Inventory page" })
  async create(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("keywordId", new ParseUUIDPipe()) keywordId: string,
    @Body(new ZodValidationPipe(createPageKeywordAssignmentSchema))
    body: CreatePageKeywordAssignmentDto,
    @Req() req: KeywordLibraryRequest,
  ): Promise<ApiSuccessResponse<PageKeywordAssignmentEntity>> {
    const data = await this.assignments.create(keywordId, projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Remove a page assignment from a keyword" })
  async remove(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("keywordId", new ParseUUIDPipe()) keywordId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: KeywordLibraryRequest,
  ): Promise<void> {
    await this.assignments.remove(id, keywordId, projectId, req.authUser!.id);
  }
}
