import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { ReadyForClaudeTaskEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeReadyForClaudeTaskStatusSchema,
  createReadyForClaudeTaskSchema,
  listReadyForClaudeTasksQuerySchema,
  updateReadyForClaudeTaskSchema,
  type ChangeReadyForClaudeTaskStatusDto,
  type CreateReadyForClaudeTaskDto,
  type ListReadyForClaudeTasksQueryDto,
  type UpdateReadyForClaudeTaskDto,
} from "./ready-for-claude-queue.dto.js";
import { READY_FOR_CLAUDE_QUEUE_MODULE_KEY } from "./ready-for-claude-queue.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ReadyForClaudeTasksService } from "./ready-for-claude-tasks.service.js";

type ReadyForClaudeQueueRequest = AuthenticatedRequest & RequestWithCorrelationId;

/**
 * `@RequirePermission` is placed on every individual method, NEVER at class level —
 * `PermissionGuard` only reads `context.getHandler()` (a deliberate fail-closed design), the exact
 * bug 3+ prior modules in this codebase independently had and fixed once already.
 *
 * No `:projectId` route path segment, unlike Page Inventory/Keyword & Entity Library/Internal
 * Linking Library — this module's RBAC is organization-wide (D5) and a task's `projectId` is an
 * OPTIONAL context field, so there is no project scope for `PermissionGuard` to derive. Mirrors
 * `ReviewsController`'s own flat `/reviews` shape for the same reason.
 */
@ApiTags("ready-for-claude-queue")
@Controller("ready-for-claude-queue/tasks")
@UseGuards(SessionGuard)
export class ReadyForClaudeTasksController {
  constructor(private readonly tasks: ReadyForClaudeTasksService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(READY_FOR_CLAUDE_QUEUE_MODULE_KEY, "view")
  @ApiOperation({ summary: "List Ready for Claude tasks, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listReadyForClaudeTasksQuerySchema))
    query: ListReadyForClaudeTasksQueryDto,
    @Req() req: ReadyForClaudeQueueRequest,
  ): Promise<ApiSuccessResponse<readonly ReadyForClaudeTaskEntity[]>> {
    const data = await this.tasks.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(READY_FOR_CLAUDE_QUEUE_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one Ready for Claude task" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ReadyForClaudeQueueRequest,
  ): Promise<ApiSuccessResponse<ReadyForClaudeTaskEntity>> {
    const data = await this.tasks.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(READY_FOR_CLAUDE_QUEUE_MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a Ready for Claude task (always starts draft)" })
  async create(
    @Body(new ZodValidationPipe(createReadyForClaudeTaskSchema)) body: CreateReadyForClaudeTaskDto,
    @Req() req: ReadyForClaudeQueueRequest,
  ): Promise<ApiSuccessResponse<ReadyForClaudeTaskEntity>> {
    const data = await this.tasks.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Patch(":id")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(READY_FOR_CLAUDE_QUEUE_MODULE_KEY, "edit")
  @ApiOperation({ summary: "Edit a task's content fields (never touches status)" })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateReadyForClaudeTaskSchema)) body: UpdateReadyForClaudeTaskDto,
    @Req() req: ReadyForClaudeQueueRequest,
  ): Promise<ApiSuccessResponse<ReadyForClaudeTaskEntity>> {
    const data = await this.tasks.update(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // Deliberately NOT gated on a specific workflow action here — the real gate varies per requested
  // transition (submit/edit/review/approve, per the service's own TRANSITIONS table) and is checked
  // dynamically inside the service itself, the same layered pattern
  // internal-links.controller.ts's/keywords.controller.ts's own status routes already established.
  // PermissionGuard still runs (via @UseGuards below) checking only module `view`, so a caller with
  // no access to this module at all is still rejected at the route boundary.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(READY_FOR_CLAUDE_QUEUE_MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a Ready for Claude task's status" })
  async changeStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeReadyForClaudeTaskStatusSchema))
    body: ChangeReadyForClaudeTaskStatusDto,
    @Req() req: ReadyForClaudeQueueRequest,
  ): Promise<ApiSuccessResponse<ReadyForClaudeTaskEntity>> {
    const data = await this.tasks.changeStatus(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
