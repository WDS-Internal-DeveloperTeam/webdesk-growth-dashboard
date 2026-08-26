import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
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
import { PAGE_WORKSPACE_BASE_MODULE_KEY } from "./page-workspace.constants.js";
import { changeLifecycleStageSchema, type ChangeLifecycleStageDto } from "./page-workspace.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { PageLifecycleService } from "./page-lifecycle.service.js";

type PageWorkspaceRequest = AuthenticatedRequest & RequestWithCorrelationId;

/**
 * The page DELIVERY lifecycle (`05_Workflow_State_Machines.md §3`, task package D4/D5) — separate
 * from Page Inventory's own `workflowStage` routes, which govern the page RECORD's approval.
 *
 * Roadmap row 12: "No automatic progression through stages." There is deliberately no endpoint
 * that advances a stage implicitly — the single `POST .../lifecycle` route below is the only way
 * a stage ever changes, and every call is separately permission-checked and audited.
 */
@ApiTags("page-workspace")
@Controller("page-workspace/projects/:projectId/pages/:pageId/lifecycle")
@UseGuards(SessionGuard)
export class PageLifecycleController {
  constructor(private readonly lifecycle: PageLifecycleService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(PAGE_WORKSPACE_BASE_MODULE_KEY, "view")
  @ApiOperation({ summary: "Read a page's current delivery lifecycle stage" })
  async get(
    @Req() req: PageWorkspaceRequest,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("pageId", ParseUUIDPipe) pageId: string,
  ): Promise<ApiSuccessResponse<PageEntity>> {
    const data = await this.lifecycle.get(projectId, pageId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @UseGuards(PermissionGuard, OriginCheckGuard)
  @RequirePermission(PAGE_WORKSPACE_BASE_MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a page to the next delivery lifecycle stage" })
  async changeStage(
    @Req() req: PageWorkspaceRequest,
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Param("pageId", ParseUUIDPipe) pageId: string,
    @Body(new ZodValidationPipe(changeLifecycleStageSchema)) body: ChangeLifecycleStageDto,
  ): Promise<ApiSuccessResponse<PageEntity>> {
    const data = await this.lifecycle.changeStage(req.authUser!.id, projectId, pageId, body);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
