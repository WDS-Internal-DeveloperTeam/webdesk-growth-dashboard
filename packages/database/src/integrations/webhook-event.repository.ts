import { getIntegrationsModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { WebhookEventEntity, WebhookEventProcessingStatus } from "./entities.js";

export interface WebhookEventListFilter {
  readonly integrationId?: string;
  readonly processingStatus?: WebhookEventProcessingStatus;
  readonly limit?: number;
  readonly offset?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** Server-only-managed columns excluded and derived, not hand-retyped, mirroring
 *  `IntegrationContentFields`'s own precedent — except `receivedAt`, which the entity stores as an
 *  ISO string (`toEntityWithIsoDates`'s own output convention) but `create()` accepts as a real
 *  `Date`, so it's re-declared explicitly rather than `Omit<>`-derived from the entity's own
 *  read-shape. */
type WebhookEventContentFields = Omit<WebhookEventEntity, "id" | "receivedAt" | "createdAt"> & {
  readonly receivedAt?: Date;
};

/** No update, no delete — an application-level append-only log (D3), not a DB-trigger-enforced
 *  one; see `WebhookEventEntity`'s own doc comment for the full distinction from `audit_events`. */
export class WebhookEventRepository {
  private readonly model = getIntegrationsModels().WebhookEvent;

  async create(
    input: Partial<WebhookEventContentFields> & Pick<WebhookEventContentFields, "eventType">,
  ): Promise<WebhookEventEntity> {
    const instance = await this.model.create({
      integrationId: input.integrationId ?? null,
      eventType: input.eventType,
      receivedAt: input.receivedAt ?? new Date(),
      payloadSummary: input.payloadSummary ?? null,
      processingStatus: input.processingStatus ?? "received",
      errorMessage: input.errorMessage ?? null,
    });
    return toEntityWithIsoDates<WebhookEventEntity>(instance);
  }

  async findById(id: string): Promise<WebhookEventEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<WebhookEventEntity>(instance) : null;
  }

  async list(filter: WebhookEventListFilter = {}): Promise<readonly WebhookEventEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.integrationId) {
      where.integrationId = filter.integrationId;
    }
    if (filter.processingStatus) {
      where.processingStatus = filter.processingStatus;
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      order: [
        ["receivedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<WebhookEventEntity>(row));
  }
}
