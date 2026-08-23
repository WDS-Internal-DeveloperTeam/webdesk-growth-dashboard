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
import type { PageUrlEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createPageUrlSchema,
  updatePageUrlSchema,
  type CreatePageUrlDto,
  type UpdatePageUrlDto,
} from "./page-inventory.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { PageUrlsService } from "./page-urls.service.js";

type PageInventoryRequest = AuthenticatedRequest & RequestWithCorrelationId;
const MODULE_KEY = "page_inventory";

/** URLs aren't independently governed by the parent page's own workflow-stage lifecycle — gated
 *  on the same `MODULE_KEY` with `view`/`edit` actions, mirroring `ClaimSourcesController`'s own
 *  sub-resource gating pattern (`apps/dashboard-api/src/proof-and-claims-library/claim-sources.controller.ts`).
 *  `@RequirePermission` is placed on every individual method, never at class level, same
 *  discipline as `PagesController`. */
@ApiTags("page-inventory")
@Controller("page-inventory/pages/:pageId/urls")
@UseGuards(SessionGuard)
export class PageUrlsController {
  constructor(private readonly pageUrls: PageUrlsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List a page's URLs" })
  async list(
    @Param("pageId", new ParseUUIDPipe()) pageId: string,
    @Req() req: PageInventoryRequest,
  ): Promise<ApiSuccessResponse<readonly PageUrlEntity[]>> {
    const data = await this.pageUrls.listByPage(pageId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Add a URL to a page" })
  async create(
    @Param("pageId", new ParseUUIDPipe()) pageId: string,
    @Body(new ZodValidationPipe(createPageUrlSchema)) body: CreatePageUrlDto,
    @Req() req: PageInventoryRequest,
  ): Promise<ApiSuccessResponse<PageUrlEntity>> {
    const data = await this.pageUrls.create(pageId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Update a page URL" })
  async update(
    @Param("pageId", new ParseUUIDPipe()) pageId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updatePageUrlSchema)) body: UpdatePageUrlDto,
    @Req() req: PageInventoryRequest,
  ): Promise<ApiSuccessResponse<PageUrlEntity>> {
    const data = await this.pageUrls.update(id, pageId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/delete")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Remove a page URL" })
  async remove(
    @Param("pageId", new ParseUUIDPipe()) pageId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: PageInventoryRequest,
  ): Promise<void> {
    await this.pageUrls.remove(id, pageId, req.authUser!.id);
  }
}
