import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { NotificationEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createNotificationSchema,
  listNotificationsQuerySchema,
  type CreateNotificationDto,
  type ListNotificationsQueryDto,
} from "./notifications.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { NotificationService } from "./notification.service.js";

type NotificationsRequest = AuthenticatedRequest & RequestWithCorrelationId;

/**
 * The notification domain's own HTTP surface (brief §28) — same "prove the
 * framework" role every other Phase 1E controller has played. Reuses the
 * existing `system_settings` module (the approved 43-module registry's own
 * `notification_center` → `system_settings` mapping, migration `00015`)
 * with two new, zero-seeded actions (`notifications_view`/
 * `notifications_configure` — the exact pair §29's own example list names)
 * — deny-by-default until a separate, later authorization seeds real
 * grants. See docs/task-packages/phase-1e-notification-foundation.md §6.
 */
@ApiTags("notifications")
@Controller("notifications")
@UseGuards(SessionGuard)
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission("system_settings", "notifications_view")
  @ApiOperation({ summary: "List notifications, optionally filtered by state/project/type" })
  async list(
    @Query(new ZodValidationPipe(listNotificationsQuerySchema)) query: ListNotificationsQueryDto,
    @Req() req: NotificationsRequest,
  ): Promise<ApiSuccessResponse<readonly NotificationEntity[]>> {
    const notifications = await this.notificationService.list(query);
    return { success: true, data: notifications, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission("system_settings", "notifications_view")
  @ApiOperation({ summary: "Get a single notification by id" })
  async getById(
    @Param("id") id: string,
    @Req() req: NotificationsRequest,
  ): Promise<ApiSuccessResponse<NotificationEntity>> {
    const notification = await this.notificationService.findById(id);
    return { success: true, data: notification, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission("system_settings", "notifications_configure")
  @ApiOperation({
    summary:
      "Create a notification — the domain-model proof surface; no real notification producer exists yet",
  })
  async create(
    @Body(new ZodValidationPipe(createNotificationSchema)) body: CreateNotificationDto,
    @Req() req: NotificationsRequest,
  ): Promise<ApiSuccessResponse<NotificationEntity>> {
    const notification = await this.notificationService.create({
      ...body,
      correlationId: req.correlationId ?? null,
    });
    return { success: true, data: notification, correlationId: req.correlationId ?? "unknown" };
  }

  @Post(":id/attempt-delivery")
  @HttpCode(HttpStatus.OK)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission("system_settings", "notifications_configure")
  @ApiOperation({
    summary:
      "Attempt delivery via the configured adapter — no real SMTP is wired in this phase, so this always ends in retrying/permanently_failed",
  })
  async attemptDelivery(
    @Param("id") id: string,
    @Req() req: NotificationsRequest,
  ): Promise<ApiSuccessResponse<NotificationEntity>> {
    const notification = await this.notificationService.attemptDelivery(id);
    return { success: true, data: notification, correlationId: req.correlationId ?? "unknown" };
  }
}
