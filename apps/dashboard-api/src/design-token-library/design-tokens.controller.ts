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
import type { DesignTokenEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import { MODULE_KEY } from "./design-token-library.constants.js";
import {
  changeDesignTokenApprovalStatusSchema,
  createDesignTokenSchema,
  listDesignTokensQuerySchema,
  updateDesignTokenSchema,
  type ChangeDesignTokenApprovalStatusDto,
  type CreateDesignTokenDto,
  type ListDesignTokensQueryDto,
  type UpdateDesignTokenDto,
} from "./design-token-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { DesignTokensService } from "./design-tokens.service.js";

type DesignTokenLibraryRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("design-token-library")
@Controller("design-token-library/tokens")
@UseGuards(SessionGuard)
export class DesignTokensController {
  constructor(private readonly tokens: DesignTokensService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "List design tokens (current versions only)" })
  async list(
    @Query(new ZodValidationPipe(listDesignTokensQuerySchema))
    query: ListDesignTokensQueryDto,
    @Req() req: DesignTokenLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly DesignTokenEntity[]>> {
    const data = await this.tokens.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":recordId")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get the current version of one design token" })
  async findOne(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Req() req: DesignTokenLibraryRequest,
  ): Promise<ApiSuccessResponse<DesignTokenEntity>> {
    const data = await this.tokens.findCurrent(recordId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":recordId/versions")
  @UseGuards(PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Get the full version history of one design token" })
  async versions(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Req() req: DesignTokenLibraryRequest,
  ): Promise<ApiSuccessResponse<readonly DesignTokenEntity[]>> {
    const data = await this.tokens.listVersions(recordId);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a design token (always starts draft, version 1)" })
  async create(
    @Body(new ZodValidationPipe(createDesignTokenSchema))
    body: CreateDesignTokenDto,
    @Req() req: DesignTokenLibraryRequest,
  ): Promise<ApiSuccessResponse<DesignTokenEntity>> {
    const data = await this.tokens.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":recordId/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "edit")
  @ApiOperation({
    summary:
      "Edit a design token's fields — mutates the current version in place if it isn't " +
      "approved yet, otherwise creates a new draft version",
  })
  async update(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Body(new ZodValidationPipe(updateDesignTokenSchema))
    body: UpdateDesignTokenDto,
    @Req() req: DesignTokenLibraryRequest,
  ): Promise<ApiSuccessResponse<DesignTokenEntity>> {
    const data = await this.tokens.update(recordId, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":recordId/status")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("approve") here — the real gate varies per requested transition
  // (submit/review/approve) and is checked dynamically inside the service itself, the same
  // layered pattern website-strategy-records.controller.ts's/claims.controller.ts's/
  // services.controller.ts's/personas.controller.ts's own status route already established.
  // PermissionGuard still runs (via @UseGuards below) checking only module `view`, so a caller
  // with no access to this module at all is still rejected at the route. A successful
  // "-> approved" transition additionally, atomically, supersedes the record's
  // previously-current-approved version, if one exists.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(MODULE_KEY, "view")
  @ApiOperation({ summary: "Transition a design token's approval status" })
  async changeStatus(
    @Param("recordId", new ParseUUIDPipe()) recordId: string,
    @Body(new ZodValidationPipe(changeDesignTokenApprovalStatusSchema))
    body: ChangeDesignTokenApprovalStatusDto,
    @Req() req: DesignTokenLibraryRequest,
  ): Promise<ApiSuccessResponse<DesignTokenEntity>> {
    const data = await this.tokens.changeApprovalStatus(
      recordId,
      body.approvalStatus,
      req.authUser!.id,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
