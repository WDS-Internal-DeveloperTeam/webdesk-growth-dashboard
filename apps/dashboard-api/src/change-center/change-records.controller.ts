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
import type { ChangeRecordEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeChangeRecordStatusSchema,
  createChangeRecordSchema,
  listChangeRecordsQuerySchema,
  updateChangeRecordSchema,
  type ChangeChangeRecordStatusDto,
  type CreateChangeRecordDto,
  type ListChangeRecordsQueryDto,
  type UpdateChangeRecordDto,
} from "./change-center.dto.js";
import { CHANGE_CENTER_MODULE_KEY } from "./change-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ChangeRecordsService } from "./change-records.service.js";

type ChangeCenterRequest = AuthenticatedRequest & RequestWithCorrelationId;

/** `@RequirePermission` is placed on every individual method, never at class level —
 *  `PermissionGuard` only reads `context.getHandler()` (a deliberate fail-closed design), the
 *  exact bug several prior modules in this codebase independently had and fixed once already.
 *
 *  `:projectId` is a real route path parameter, not a query/body field — `PermissionGuard` only
 *  ever reads `request.params?.projectId`, mirroring Scan Center's/Internal Linking Library's own
 *  `.../projects/:projectId/...` shape exactly. */
@ApiTags("change-center")
@Controller("change-center/projects/:projectId/records")
@UseGuards(SessionGuard)
export class ChangeRecordsController {
  constructor(private readonly records: ChangeRecordsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(CHANGE_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "List change records for a project, optionally filtered" })
  async list(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Query(new ZodValidationPipe(listChangeRecordsQuerySchema)) query: ListChangeRecordsQueryDto,
    @Req() req: ChangeCenterRequest,
  ): Promise<ApiSuccessResponse<readonly ChangeRecordEntity[]>> {
    const { assignedToMe, ...rest } = query;
    const data = await this.records.list({
      ...rest,
      projectId,
      assignedToUserId: assignedToMe ? req.authUser!.id : rest.assignedToUserId,
    });
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(CHANGE_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one change record" })
  async findOne(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: ChangeCenterRequest,
  ): Promise<ApiSuccessResponse<ChangeRecordEntity>> {
    const data = await this.records.findById(id, projectId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(CHANGE_CENTER_MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a change record (always starts detected)" })
  async create(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Body(new ZodValidationPipe(createChangeRecordSchema)) body: CreateChangeRecordDto,
    @Req() req: ChangeCenterRequest,
  ): Promise<ApiSuccessResponse<ChangeRecordEntity>> {
    const data = await this.records.create(projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(CHANGE_CENTER_MODULE_KEY, "edit")
  @ApiOperation({
    summary:
      "Edit a change record's content fields while it's still detected/under_review (never touches status)",
  })
  async update(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateChangeRecordSchema)) body: UpdateChangeRecordDto,
    @Req() req: ChangeCenterRequest,
  ): Promise<ApiSuccessResponse<ChangeRecordEntity>> {
    const data = await this.records.update(id, projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("review"/"approve") here — the real gate varies per requested transition
  // and is checked dynamically inside the service, the same layered pattern
  // InternalLinksController's/ScanRunsController's own status route already established.
  // PermissionGuard still runs (via @UseGuards below) checking only module `view`, so a caller
  // with no access to this module at all is still rejected at the route.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(CHANGE_CENTER_MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a change record's status" })
  async changeStatus(
    @Param("projectId", new ParseUUIDPipe()) projectId: string,
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeChangeRecordStatusSchema))
    body: ChangeChangeRecordStatusDto,
    @Req() req: ChangeCenterRequest,
  ): Promise<ApiSuccessResponse<ChangeRecordEntity>> {
    const data = await this.records.changeStatus(id, projectId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
