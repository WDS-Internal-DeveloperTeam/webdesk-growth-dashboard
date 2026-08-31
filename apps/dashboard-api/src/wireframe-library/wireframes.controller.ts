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
import type { WireframeRecordEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import { MODULE_KEY } from "./wireframe-library.constants.js";
import {
  changeWireframeApprovalStatusSchema,
  createWireframeRecordSchema,
  listWireframeRecordsQuerySchema,
  updateWireframeRecordSchema,
  type ChangeWireframeApprovalStatusDto,
  type CreateWireframeRecordDto,
  type ListWireframeRecordsQueryDto,
  type UpdateWireframeRecordDto,
} from "./wireframe-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { WireframesService } from "./wireframes.service.js";

type WireframeLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("wireframe-library")
@Controller("wireframe-library/records")
@UseGuards(SessionGuard)
export class WireframesController {
  constructor(private readonly wireframes: WireframesService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List wireframe records (current versions only)" })
  async list(
    @Query(new ZodValidationPipe(listWireframeRecordsQuerySchema))
    query: ListWireframeRecordsQueryDto,
    @Req() req: WireframeLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly WireframeRecordEntity[]>> {
    const data = await this.wireframes.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":recordId")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get the current version of one wireframe record" })
  async findOne(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Req() req: WireframeLibraryRequest,
  ): Promise<ApiSuccessResponse<WireframeRecordEntity>> {
    const data = await this.wireframes.findCurrent(recordId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":recordId/versions")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get the full version history of one wireframe record" })
  async versions(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Req() req: WireframeLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly WireframeRecordEntity[]>> {
    const data = await this.wireframes.listVersions(recordId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a wireframe record (always starts draft, version 1)" })
  async create(
    @Body(new ZodValidationPipe(createWireframeRecordSchema))
    body: CreateWireframeRecordDto,
    @Req() req: WireframeLibraryRequest,
  ): Promise<ApiSuccessResponse<WireframeRecordEntity>> {
    const data = await this.wireframes.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":recordId/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({
    summary:
      "Edit a wireframe record's fields — mutates the current version in place if it isn't " +
      "approved yet, otherwise creates a new draft version",
  })
  async update(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Body(new ZodValidationPipe(updateWireframeRecordSchema))
    body: UpdateWireframeRecordDto,
    @Req() req: WireframeLibraryRequest,
  ): Promise<ApiSuccessResponse<WireframeRecordEntity>> {
    const data = await this.wireframes.update(recordId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":recordId/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve) and is checked dynamically inside the service itself, the same
  // layered pattern section-patterns.controller.ts's/design-tokens.controller.ts's own status
  // route already established. PermissionGuard still runs (via @UseGuards below) checking only
  // module `view`, so a caller with no access to this module at all is still rejected at the
  // route. A successful "-> approved" transition additionally, atomically, supersedes the
  // record's previously-current-approved version, if one exists.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a wireframe record's approval status" })
  async changeStatus(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Body(new ZodValidationPipe(changeWireframeApprovalStatusSchema))
    body: ChangeWireframeApprovalStatusDto,
    @Req() req: WireframeLibraryRequest,
  ): Promise<ApiSuccessResponse<WireframeRecordEntity>> {
    const data = await this.wireframes.changeApprovalStatus(
      recordId,
      body.approvalStatus,
      req.authUser!.id,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
