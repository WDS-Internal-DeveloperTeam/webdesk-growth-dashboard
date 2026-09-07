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
import type { WebhookEventEntity } from "@webdesk/database";
import type { ApiSuccessResponse } from "@webdesk/shared-types";
import type { RequestWithCorrelationId } from "../common/correlation-id.middleware.js";
import { OriginCheckGuard } from "../auth/common/origin-check.guard.js";
import type { AuthenticatedRequest } from "../auth/session/session.guard.js";
import { SessionGuard } from "../auth/session/session.guard.js";
import { ZodValidationPipe } from "../common/zod-validation.pipe.js";
import { PermissionGuard } from "../authz/permission.guard.js";
import { RequirePermission } from "../authz/require-permission.decorator.js";
import {
  createWebhookEventSchema,
  listWebhookEventsQuerySchema,
  type CreateWebhookEventDto,
  type ListWebhookEventsQueryDto,
} from "./integrations.dto.js";
import { INTEGRATIONS_MODULE_KEY } from "./integrations.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { WebhookEventsService } from "./webhook-events.service.js";

type IntegrationsRequest = AuthenticatedRequest & RequestWithCorrelationId;

/**
 * Nested under `/integrations/:integrationId/webhook-events` (scoped list/get). A separate,
 * unscoped `WebhookEventsGlobalController` below carries the bare `POST /webhook-events` and
 * `GET /webhook-events` routes — an event may arrive before it can be matched to a known
 * integration (D-schema), so the record-an-event action can't always carry an `:integrationId`
 * path segment. No update, no delete route exists at all — immutable once created.
 */
@ApiTags("integrations")
@Controller("integrations/:integrationId/webhook-events")
@UseGuards(SessionGuard)
export class WebhookEventsController {
  constructor(private readonly events: WebhookEventsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "view")
  @ApiOperation({ summary: "List webhook events received for one integration" })
  async list(
    @Param("integrationId", new ParseUUIDPipe()) integrationId: string,
    @Query(new ZodValidationPipe(listWebhookEventsQuerySchema)) query: ListWebhookEventsQueryDto,
    @Req() req: IntegrationsRequest,
  ): Promise<ApiSuccessResponse<readonly WebhookEventEntity[]>> {
    const data = await this.events.listByIntegration(integrationId, query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}

/** The bare `/webhook-events` routes — see the doc comment on `WebhookEventsController` above. */
@ApiTags("integrations")
@Controller("webhook-events")
@UseGuards(SessionGuard)
export class WebhookEventsGlobalController {
  constructor(private readonly events: WebhookEventsService) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "view")
  @ApiOperation({ summary: "List webhook events across every integration" })
  async list(
    @Query(new ZodValidationPipe(listWebhookEventsQuerySchema)) query: ListWebhookEventsQueryDto,
    @Req() req: IntegrationsRequest,
  ): Promise<ApiSuccessResponse<readonly WebhookEventEntity[]>> {
    const data = await this.events.list(query);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Get(":id")
  @UseGuards(PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "view")
  @ApiOperation({ summary: "Get one webhook event" })
  async findOne(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Req() req: IntegrationsRequest,
  ): Promise<ApiSuccessResponse<WebhookEventEntity>> {
    const data = await this.events.findById(id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(OriginCheckGuard, PermissionGuard)
  @RequirePermission(INTEGRATIONS_MODULE_KEY, "create")
  @ApiOperation({ summary: "Manually record a webhook delivery (no live receiver exists yet)" })
  async create(
    @Body(new ZodValidationPipe(createWebhookEventSchema)) body: CreateWebhookEventDto,
    @Req() req: IntegrationsRequest,
  ): Promise<ApiSuccessResponse<WebhookEventEntity>> {
    const data = await this.events.create(body, req.authUser!.id);
    return { success: true, data, correlationId: req.correlationId ?? "unknown" };
  }
}
