import type { Model } from "sequelize";
import { getSystemOperationsModels } from "./models.js";
import type { SystemEventEntity, SystemEventSeverity } from "./entities.js";

function toEntity(instance: Model): SystemEventEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    eventType: json.eventType as string,
    category: (json.category as string | null) ?? null,
    severity: (json.severity as SystemEventSeverity | null) ?? null,
    sourceApplication: (json.sourceApplication as string | null) ?? null,
    relatedEntityType: (json.relatedEntityType as string | null) ?? null,
    relatedEntityId: (json.relatedEntityId as string | null) ?? null,
    correlationId: (json.correlationId as string | null) ?? null,
    message: json.message as string,
    metadata: (json.metadata as Record<string, unknown> | null) ?? null,
    relatedAuditEventId: (json.relatedAuditEventId as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
  };
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** Append-only — the user-facing activity feed, deliberately separate from `AuditEventRepository`. See ../system-operations/entities.ts's doc comment. */
export class SystemEventRepository {
  private readonly model = getSystemOperationsModels().SystemEvent;

  async record(input: {
    eventType: string;
    category?: string | null;
    severity?: SystemEventSeverity | null;
    sourceApplication?: string | null;
    relatedEntityType?: string | null;
    relatedEntityId?: string | null;
    correlationId?: string | null;
    message: string;
    metadata?: Record<string, unknown> | null;
    relatedAuditEventId?: string | null;
  }): Promise<SystemEventEntity> {
    const instance = await this.model.create({
      eventType: input.eventType,
      category: input.category ?? null,
      severity: input.severity ?? null,
      sourceApplication: input.sourceApplication ?? null,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      correlationId: input.correlationId ?? null,
      message: input.message,
      metadata: input.metadata ?? null,
      relatedAuditEventId: input.relatedAuditEventId ?? null,
    });
    return toEntity(instance);
  }

  async findById(id: string): Promise<SystemEventEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntity(instance) : null;
  }

  async list(filter: {
    eventType?: string;
    category?: string;
    severity?: SystemEventSeverity;
    relatedEntityType?: string;
    relatedEntityId?: string;
    correlationId?: string;
    limit?: number;
    offset?: number;
  }): Promise<readonly SystemEventEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.eventType) {
      where.eventType = filter.eventType;
    }
    if (filter.category) {
      where.category = filter.category;
    }
    if (filter.severity) {
      where.severity = filter.severity;
    }
    if (filter.relatedEntityType) {
      where.relatedEntityType = filter.relatedEntityType;
    }
    if (filter.relatedEntityId) {
      where.relatedEntityId = filter.relatedEntityId;
    }
    if (filter.correlationId) {
      where.correlationId = filter.correlationId;
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map(toEntity);
  }
}
