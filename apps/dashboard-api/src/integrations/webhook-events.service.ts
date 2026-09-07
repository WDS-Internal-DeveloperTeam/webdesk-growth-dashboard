import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  IntegrationRepository,
  WebhookEventEntity,
  WebhookEventListFilter,
  WebhookEventRepository,
} from "@webdesk/database";
import { INTEGRATION_REPOSITORY, WEBHOOK_EVENT_REPOSITORY } from "./integrations.constants.js";
import type { CreateWebhookEventDto } from "./integrations.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";

/**
 * An append-only log of received webhook deliveries — no update, no delete route exists at all
 * (D-schema, matching the `audit_events` precedent). Since no real webhook receiver exists yet
 * (D1 — record-keeping only), this module's only write path is a manual "record an event" route
 * for ops use, not a live receiver.
 */
@Injectable()
export class WebhookEventsService {
  constructor(
    @Inject(INTEGRATION_REPOSITORY) private readonly integrations: IntegrationRepository,
    @Inject(WEBHOOK_EVENT_REPOSITORY) private readonly events: WebhookEventRepository,
    private readonly auditService: AuditService,
  ) {}

  /**
   * `integrationId` is optional (D-schema: "an event may arrive before it can be matched to a
   * known integration") — when supplied, it must reference a real integration, surfacing a clean
   * 400 rather than a silently-accepted dangling reference.
   */
  async create(input: CreateWebhookEventDto, actorUserId: string): Promise<WebhookEventEntity> {
    if (input.integrationId) {
      const exists = await this.integrations.existsById(input.integrationId);
      if (!exists) {
        throw new BadRequestException(`Integration not found: ${input.integrationId}`);
      }
    }

    const created = await this.events.create({
      integrationId: input.integrationId ?? null,
      eventType: input.eventType,
      receivedAt: input.receivedAt ? new Date(input.receivedAt) : undefined,
      payloadSummary: input.payloadSummary,
      processingStatus: input.processingStatus,
      errorMessage: input.errorMessage,
    });

    await this.auditService.record({
      eventType: "webhook_processed",
      actorUserId,
      actorType: "human",
      entityType: "webhook_event",
      entityId: created.id,
      action: "create",
      afterState: { integrationId: created.integrationId, eventType: created.eventType },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async findById(id: string): Promise<WebhookEventEntity> {
    const event = await this.events.findById(id);
    if (!event) {
      throw new NotFoundException(`Webhook event not found: ${id}`);
    }
    return event;
  }

  /**
   * Scoped to one integration via the route's own `:integrationId` — the `integrationId` filter
   * value is threaded through by the controller, this method just re-validates the parent
   * integration exists first (a clean 404 for a nonexistent integration, matching every sibling
   * sub-resource list method's own precedent).
   */
  async listByIntegration(
    integrationId: string,
    filter: Omit<WebhookEventListFilter, "integrationId">,
  ): Promise<readonly WebhookEventEntity[]> {
    const exists = await this.integrations.existsById(integrationId);
    if (!exists) {
      throw new NotFoundException(`Integration not found: ${integrationId}`);
    }
    return this.events.list({ ...filter, integrationId });
  }

  /** The bare `GET /webhook-events` route — no integration scoping, lists across every
   *  integration (including unmatched events, `integrationId: null`). */
  async list(filter: WebhookEventListFilter): Promise<readonly WebhookEventEntity[]> {
    return this.events.list(filter);
  }
}
