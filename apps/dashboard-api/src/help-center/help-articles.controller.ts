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
import type { HelpArticleEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createHelpArticleSchema,
  listHelpArticlesQuerySchema,
  updateHelpArticleSchema,
  type CreateHelpArticleDto,
  type ListHelpArticlesQueryDto,
  type UpdateHelpArticleDto,
} from "./help-center.dto.js";
import { HELP_CENTER_MODULE_KEY } from "./help-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { HelpArticlesService } from "./help-articles.service.js";

type HelpCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("help-center")
@Controller("help-center/articles")
@UseGuards(SessionGuard)
export class HelpArticlesController {
  constructor(private readonly articles: HelpArticlesService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(HELP_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "List help articles, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listHelpArticlesQuerySchema)) query: ListHelpArticlesQueryDto,
    @Req() req: HelpCenterRequest,
  ): Promise<ApiSuccessResponse<readonly HelpArticleEntity[]>> {
    const data = await this.articles.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(HELP_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one help article" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: HelpCenterRequest,
  ): Promise<ApiSuccessResponse<HelpArticleEntity>> {
    const data = await this.articles.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(HELP_CENTER_MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a help article" })
  async create(
    @Body(new ZodValidationPipe(createHelpArticleSchema)) body: CreateHelpArticleDto,
    @Req() req: HelpCenterRequest,
  ): Promise<ApiSuccessResponse<HelpArticleEntity>> {
    const data = await this.articles.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(HELP_CENTER_MODULE_KEY, "edit")
  @ApiOperation({
    summary: "Edit a help article's fields, including toggling isPublished (never category)",
  })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateHelpArticleSchema)) body: UpdateHelpArticleDto,
    @Req() req: HelpCenterRequest,
  ): Promise<ApiSuccessResponse<HelpArticleEntity>> {
    const data = await this.articles.update(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
