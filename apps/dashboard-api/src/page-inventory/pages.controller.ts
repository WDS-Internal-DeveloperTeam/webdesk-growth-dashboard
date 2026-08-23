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
import type { PageEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changePageWorkflowStageSchema,
  createPageSchema,
  listPagesQuerySchema,
  updatePageSchema,
  type ChangePageWorkflowStageDto,
  type CreatePageDto,
  type ListPagesQueryDto,
  type UpdatePageDto,
} from "./page-inventory.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { PagesService } from "./pages.service.js";

type PageInventoryRequest = AuthenticatedRequest & RequestWithCorrelationId;

const MODULE_KEY = "page_inventory";

/** `@RequirePermission` is placed on every individual method, never at class level —
 *  `PermissionGuard` only reads `context.getHandler()` (a deliberate fail-closed design), the
 *  exact bug Service Library's own dimensions controller had and fixed once already.
 *
 *  `:projectId` is a real route path parameter (code-review finding, `module-page-inventory`:
 *  every route here previously took `projectId` as a query param/body field, which
 *  `PermissionGuard` never reads — it only reads `request.params?.projectId` — so a caller
 *  holding only a project-scoped `page_inventory` grant (not a global one) was silently denied on
 *  every route, undermining the exact project-scoping design this module was built around. Mirrors
 *  `RoadmapItemsController`'s own `projects/:projectId/roadmap-items` shape exactly. */
@ApiTags("page-inventory")
@Controller("page-inventory/projects/:projectId/pages")
@UseGuards(SessionGuard)
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List pages for a project, optionally filtered" })
  async list(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Query(new ZodValidationPipe(listPagesQuerySchema)) query: ListPagesQueryDto,
    @Req() req: PageInventoryRequest,
  ): Promise<ApiSuccessResponse<readonly PageEntity[]>> {
    const data = await this.pages.list({ ...query, projectId });
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one page" })
  async findOne(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: PageInventoryRequest,
  ): Promise<ApiSuccessResponse<PageEntity>> {
    const data = await this.pages.findById(id, projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a page (always starts draft)" })
  async create(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Body(new ZodValidationPipe(createPageSchema)) body: CreatePageDto,
    @Req() req: PageInventoryRequest,
  ): Promise<ApiSuccessResponse<PageEntity>> {
    const data = await this.pages.create(projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({ summary: "Edit a page's content fields (never touches workflowStage)" })
  async update(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updatePageSchema)) body: UpdatePageDto,
    @Req() req: PageInventoryRequest,
  ): Promise<ApiSuccessResponse<PageEntity>> {
    const data = await this.pages.update(id, projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/workflow-stage")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve) and is checked dynamically inside the service itself, the same
  // layered pattern claims.controller.ts's/personas.controller.ts's/services.controller.ts's own
  // status route already established. PermissionGuard still runs (via @UseGuards below) checking
  // only module `view`, so a caller with no access to this module at all is still rejected at the
  // route.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a page's workflow stage" })
  async changeWorkflowStage(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changePageWorkflowStageSchema))
    body: ChangePageWorkflowStageDto,
    @Req() req: PageInventoryRequest,
  ): Promise<ApiSuccessResponse<PageEntity>> {
    const data = await this.pages.changeWorkflowStage(
      id,
      projectId,
      body.workflowStage,
      req.authUser!.id,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
