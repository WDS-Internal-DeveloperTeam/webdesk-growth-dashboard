import type { Model } from "sequelize";
import { getAuditModels } from "./models.js";
import type { AuditActorType, AuditEventEntity, AuditEventType } from "./entities.js";

function toEntity(instance: Model): AuditEventEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    eventType: json.eventType as AuditEventType,
    actorUserId: (json.actorUserId as string | null) ?? null,
    actorType: json.actorType as AuditActorType,
    entityType: json.entityType as string,
    entityId: json.entityId as string,
    entityVersion: (json.entityVersion as number | null) ?? null,
    action: json.action as string,
    beforeState: (json.beforeState as Record<string, unknown> | null) ?? null,
    afterState: (json.afterState as Record<string, unknown> | null) ?? null,
    reason: (json.reason as string | null) ?? null,
    relatedGateOrApprovalId: (json.relatedGateOrApprovalId as string | null) ?? null,
    gitCommitSha: (json.gitCommitSha as string | null) ?? null,
    retentionCategory: json.retentionCategory as string,
    legalHold: json.legalHold as boolean,
    legalHoldReason: (json.legalHoldReason as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
  };
}

/**
 * Append-only by construction: exactly one write method, `record` — no
 * `update`, no `delete`, ever exposed here. Unlike `AuthEventRepository`,
 * that convention is backed by a real database-level guarantee (migration
 * 00018's trigger) — this class simply never needs to try circumventing it.
 */
export class AuditEventRepository {
  private readonly model = getAuditModels().AuditEvent;

  async record(input: {
    eventType: AuditEventType;
    actorUserId?: string | null;
    actorType: AuditActorType;
    entityType: string;
    entityId: string;
    entityVersion?: number | null;
    action: string;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
    reason?: string | null;
    relatedGateOrApprovalId?: string | null;
    gitCommitSha?: string | null;
    retentionCategory: string;
    legalHold?: boolean;
    legalHoldReason?: string | null;
  }): Promise<AuditEventEntity> {
    const instance = await this.model.create({
      eventType: input.eventType,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType,
      entityType: input.entityType,
      entityId: input.entityId,
      entityVersion: input.entityVersion ?? null,
      action: input.action,
      beforeState: input.beforeState ?? null,
      afterState: input.afterState ?? null,
      reason: input.reason ?? null,
      relatedGateOrApprovalId: input.relatedGateOrApprovalId ?? null,
      gitCommitSha: input.gitCommitSha ?? null,
      retentionCategory: input.retentionCategory,
      legalHold: input.legalHold ?? false,
      legalHoldReason: input.legalHoldReason ?? null,
    });
    return toEntity(instance);
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    limit = 100,
  ): Promise<readonly AuditEventEntity[]> {
    const rows = await this.model.findAll({
      where: { entityType, entityId },
      order: [["createdAt", "DESC"]],
      limit,
    });
    return rows.map(toEntity);
  }

  async findRecentByActor(actorUserId: string, limit = 50): Promise<readonly AuditEventEntity[]> {
    const rows = await this.model.findAll({
      where: { actorUserId },
      order: [["createdAt", "DESC"]],
      limit,
    });
    return rows.map(toEntity);
  }
}
