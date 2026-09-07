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
import type { SystemSettingEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  changeSystemSettingActiveStateSchema,
  createSystemSettingSchema,
  listSystemSettingsQuerySchema,
  updateSystemSettingSchema,
  type ChangeSystemSettingActiveStateDto,
  type CreateSystemSettingDto,
  type ListSystemSettingsQueryDto,
  type UpdateSystemSettingDto,
} from "./system-settings.dto.js";
import { SYSTEM_SETTINGS_MODULE_KEY } from "./system-settings.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { SystemSettingsService } from "./system-settings.service.js";

type SystemSettingsRequest = AuthenticatedRequest & RequestWithCorrelationId;

@ApiTags("system-settings")
@Controller("system-settings/settings")
@UseGuards(SessionGuard)
export class SystemSettingsController {
  constructor(private readonly systemSettings: SystemSettingsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(SYSTEM_SETTINGS_MODULE_KEY, "view")
  @ApiOperation({ summary: "List system settings, optionally filtered" })
  async list(
    @Query(new ZodValidationPipe(listSystemSettingsQuerySchema))
    query: ListSystemSettingsQueryDto,
    @Req() req: SystemSettingsRequest,
  ): Promise<ApiSuccessResponse<readonly SystemSettingEntity[]>> {
    const data = await this.systemSettings.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(SYSTEM_SETTINGS_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one system setting" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: SystemSettingsRequest,
  ): Promise<ApiSuccessResponse<SystemSettingEntity>> {
    const data = await this.systemSettings.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(SYSTEM_SETTINGS_MODULE_KEY, "create")
  @ApiOperation({ summary: "Create a system setting (always starts active)" })
  async create(
    @Body(new ZodValidationPipe(createSystemSettingSchema)) body: CreateSystemSettingDto,
    @Req() req: SystemSettingsRequest,
  ): Promise<ApiSuccessResponse<SystemSettingEntity>> {
    const data = await this.systemSettings.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/update")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(SYSTEM_SETTINGS_MODULE_KEY, "edit")
  @ApiOperation({
    summary: "Edit a system setting's content fields (value/description/key — never isActive)",
  })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(updateSystemSettingSchema)) body: UpdateSystemSettingDto,
    @Req() req: SystemSettingsRequest,
  ): Promise<ApiSuccessResponse<SystemSettingEntity>> {
    const data = await this.systemSettings.update(id, body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/active-state")
  @HttpCode(HttpStatus.OK)
  // No @RequirePermission("configure") here — the real gate is checked dynamically inside the
  // service itself (D4: isActive is gated on "configure", not "edit"), the same layered pattern
  // Brand Library's own publish/unpublish routes already established. PermissionGuard still runs
  // (via @UseGuards below) checking only module `view`, so a caller with no access to this module
  // at all is still rejected at the route.
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(SYSTEM_SETTINGS_MODULE_KEY, "view")
  @ApiOperation({ summary: "Set a system setting's isActive state (gated on 'configure')" })
  async updateActiveState(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(changeSystemSettingActiveStateSchema))
    body: ChangeSystemSettingActiveStateDto,
    @Req() req: SystemSettingsRequest,
  ): Promise<ApiSuccessResponse<SystemSettingEntity>> {
    const data = await this.systemSettings.updateActiveState(
      id,
      body.isActive,
      req.authUser!.id,
      body.expectedIsActive,
    );
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
