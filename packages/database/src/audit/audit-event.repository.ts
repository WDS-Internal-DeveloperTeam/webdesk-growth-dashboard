import type { Model } from "sequelize";
import { getAuditModels } from "./models.js";
import { AUDIT_RETENTION_CATEGORIES } from "./entities.js";
import type {
  AuditActorType,
  AuditConfidentialityClassification,
  AuditEventCategory,
  AuditEventEntity,
  AuditEventType,
} from "./entities.js";

function toEntity(instance: Model): AuditEventEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    eventType: json.eventType as AuditEventType,
    eventCategory: json.eventCategory as AuditEventCategory,
    actorUserId: (json.actorUserId as string | null) ?? null,
    actorType: json.actorType as AuditActorType,
    sessionId: (json.sessionId as string | null) ?? null,
    projectId: (json.projectId as string | null) ?? null,
    entityType: json.entityType as string,
    entityId: json.entityId as string,
    entityVersion: (json.entityVersion as number | null) ?? null,
    action: json.action as string,
    beforeState: (json.beforeState as Record<string, unknown> | null) ?? null,
    afterState: (json.afterState as Record<string, unknown> | null) ?? null,
    reason: (json.reason as string | null) ?? null,
    relatedGateOrApprovalId: (json.relatedGateOrApprovalId as string | null) ?? null,
    gitCommitSha: (json.gitCommitSha as string | null) ?? null,
    correlationId: (json.correlationId as string | null) ?? null,
    sourceApplication: json.sourceApplication as string,
    environment: json.environment as string,
    confidentialityClassification:
      json.confidentialityClassification as AuditConfidentialityClassification,
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
    eventCategory: AuditEventCategory;
    actorUserId?: string | null;
    actorType: AuditActorType;
    sessionId?: string | null;
    projectId?: string | null;
    entityType: string;
    entityId: string;
    entityVersion?: number | null;
    action: string;
    beforeState?: Record<string, unknown> | null;
    afterState?: Record<string, unknown> | null;
    reason?: string | null;
    relatedGateOrApprovalId?: string | null;
    gitCommitSha?: string | null;
    correlationId?: string | null;
    sourceApplication: string;
    environment: string;
    confidentialityClassification: AuditConfidentialityClassification;
    retentionCategory: string;
    legalHold?: boolean;
    legalHoldReason?: string | null;
  }): Promise<AuditEventEntity> {
    // `AuditService` already checks this before calling here, but the `retention_category`
    // column is deliberately a plain STRING, not an ENUM/CHECK (so the vocabulary can grow
    // without a migration) — validating only in `AuditService` left any caller that reached this
    // repository directly with zero enforcement. Checking here too closes that gap regardless of
    // caller, from the same shared allowlist `AuditService` derives its own type from.
    if (!(AUDIT_RETENTION_CATEGORIES as readonly string[]).includes(input.retentionCategory)) {
      throw new Error(`Unrecognized audit retention_category: ${input.retentionCategory}`);
    }

    const instance = await this.model.create({
      eventType: input.eventType,
      eventCategory: input.eventCategory,
      actorUserId: input.actorUserId ?? null,
      actorType: input.actorType,
      sessionId: input.sessionId ?? null,
      projectId: input.projectId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      entityVersion: input.entityVersion ?? null,
      action: input.action,
      beforeState: input.beforeState ?? null,
      afterState: input.afterState ?? null,
      reason: input.reason ?? null,
      relatedGateOrApprovalId: input.relatedGateOrApprovalId ?? null,
      gitCommitSha: input.gitCommitSha ?? null,
      correlationId: input.correlationId ?? null,
      sourceApplication: input.sourceApplication,
      environment: input.environment,
      confidentialityClassification: input.confidentialityClassification,
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
