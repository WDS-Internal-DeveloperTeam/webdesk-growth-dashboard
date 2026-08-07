import type { Model } from "sequelize";
import { getAuthModels } from "./models.js";
import type { RecoveryRequestEntity, RecoveryRequestStatus } from "./entities.js";

function toEntity(instance: Model): RecoveryRequestEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    targetUserId: json.targetUserId as string,
    requestedByUserId: (json.requestedByUserId as string | null) ?? null,
    reason: json.reason as string,
    status: json.status as RecoveryRequestStatus,
    decidedByUserId: (json.decidedByUserId as string | null) ?? null,
    decidedAt: json.decidedAt instanceof Date ? json.decidedAt.toISOString() : null,
    decisionNote: (json.decisionNote as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

/**
 * Foundation only (ADR-0009, knowledge/05 separation-of-duties). The
 * "decided-by must differ from target" rule is enforced by the service
 * layer (apps/dashboard-api/src/auth/recovery), not here — a repository
 * has no business-rule authority, it persists what it's told.
 */
export class RecoveryRequestRepository {
  private readonly model = getAuthModels().RecoveryRequest;

  async create(input: {
    targetUserId: string;
    requestedByUserId: string | null;
    reason: string;
  }): Promise<RecoveryRequestEntity> {
    const instance = await this.model.create(input);
    return toEntity(instance);
  }

  async findById(id: string): Promise<RecoveryRequestEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntity(instance) : null;
  }

  async decide(
    id: string,
    decision: {
      status: "approved" | "rejected";
      decidedByUserId: string;
      decidedAt: Date;
      note?: string;
    },
  ): Promise<RecoveryRequestEntity> {
    const instance = await this.model.findByPk(id);
    if (!instance) {
      throw new Error(`Recovery request not found: ${id}`);
    }
    await instance.update({
      status: decision.status,
      decidedByUserId: decision.decidedByUserId,
      decidedAt: decision.decidedAt,
      decisionNote: decision.note ?? null,
    });
    return toEntity(instance);
  }
}
