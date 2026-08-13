import { Op, UniqueConstraintError, type Model } from "sequelize";
import { getIdempotencyModels } from "./models.js";
import type { IdempotencyKeyEntity, IdempotencyProcessingState } from "./entities.js";

function toEntity(instance: Model): IdempotencyKeyEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    scope: json.scope as string,
    idempotencyKey: json.idempotencyKey as string,
    resourceType: (json.resourceType as string | null) ?? null,
    action: (json.action as string | null) ?? null,
    requesterUserId: (json.requesterUserId as string | null) ?? null,
    processingState: json.processingState as IdempotencyProcessingState,
    resultReference: (json.resultReference as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
    expiresAt: json.expiresAt ? (json.expiresAt as Date).toISOString() : null,
  };
}

export type ReserveOutcome =
  | { readonly kind: "reserved"; readonly entity: IdempotencyKeyEntity }
  | { readonly kind: "duplicate"; readonly entity: IdempotencyKeyEntity }
  | { readonly kind: "in_progress"; readonly entity: IdempotencyKeyEntity };

function isExpired(entity: IdempotencyKeyEntity): boolean {
  return entity.expiresAt !== null && new Date(entity.expiresAt).getTime() < Date.now();
}

/**
 * The DB-backed conflict-detection half of the reusable idempotency
 * primitive (brief §11) — the actual work of *doing* the idempotent
 * operation lives in the caller (`apps/dashboard-api/src/jobs/idempotency.service.ts`);
 * this repository only answers "has this (scope, key) pair already been
 * reserved, and what happened to it."
 */
export class IdempotencyKeyRepository {
  private readonly model = getIdempotencyModels().IdempotencyKey;

  /**
   * Attempts to reserve `(scope, idempotencyKey)`. Relies on the real
   * database UNIQUE constraint (migration `00021`) to detect a concurrent
   * or prior reservation — not a read-then-write race.
   */
  async reserve(input: {
    scope: string;
    idempotencyKey: string;
    resourceType?: string | null;
    action?: string | null;
    requesterUserId?: string | null;
    expiresAt?: Date | null;
  }): Promise<ReserveOutcome> {
    try {
      const instance = await this.model.create({
        scope: input.scope,
        idempotencyKey: input.idempotencyKey,
        resourceType: input.resourceType ?? null,
        action: input.action ?? null,
        requesterUserId: input.requesterUserId ?? null,
        processingState: "pending",
        expiresAt: input.expiresAt ?? null,
      });
      return { kind: "reserved", entity: toEntity(instance) };
    } catch (error) {
      if (!(error instanceof UniqueConstraintError)) {
        throw error;
      }
      const existingInstance = await this.model.findOne({
        where: { scope: input.scope, idempotencyKey: input.idempotencyKey },
      });
      if (!existingInstance) {
        // The conflicting row was concurrently deleted between the failed insert and this
        // lookup — vanishingly unlikely (no delete path exists yet), but re-throw rather than
        // silently treat a genuine race as "not found".
        throw error;
      }
      const existing = toEntity(existingInstance);

      if (existing.processingState === "completed") {
        return { kind: "duplicate", entity: existing };
      }
      if (existing.processingState === "pending" && !isExpired(existing)) {
        return { kind: "in_progress", entity: existing };
      }
      // Failed or expired-pending: safe to reissue the same reservation, same row — but two
      // concurrent callers can both reach this branch for the same row (both saw it as
      // "failed" before either wrote). A plain unconditional `.update()` would let both
      // "win" and both proceed as if they alone reserved the key. Guard with a conditional
      // UPDATE (same state-CAS discipline as the original `create()`'s UNIQUE constraint) so
      // only the first writer's update actually matches a row; the loser's `affectedCount`
      // comes back 0 and it re-reads to see what state the winner left behind.
      const [affectedCount] = await this.model.update(
        {
          processingState: "pending",
          resultReference: null,
          resourceType: input.resourceType ?? existing.resourceType,
          action: input.action ?? existing.action,
          requesterUserId: input.requesterUserId ?? existing.requesterUserId,
          expiresAt: input.expiresAt ?? existing.expiresAt,
        },
        {
          where: {
            id: existing.id,
            [Op.or]: [
              { processingState: "failed" },
              { processingState: "pending", expiresAt: { [Op.lt]: new Date() } },
            ],
          },
        },
      );
      if (affectedCount > 0) {
        const reserved = await this.model.findByPk(existing.id);
        return { kind: "reserved", entity: toEntity(reserved!) };
      }
      // Another concurrent caller's conditional UPDATE won the race — report whatever it
      // left behind rather than pretending this caller reserved it too.
      const afterRace = toEntity((await this.model.findByPk(existing.id))!);
      if (afterRace.processingState === "completed") {
        return { kind: "duplicate", entity: afterRace };
      }
      return { kind: "in_progress", entity: afterRace };
    }
  }

  async complete(id: string, resultReference: string | null): Promise<IdempotencyKeyEntity | null> {
    const instance = await this.model.findByPk(id);
    if (!instance) {
      return null;
    }
    await instance.update({ processingState: "completed", resultReference });
    return toEntity(instance);
  }

  async fail(id: string): Promise<IdempotencyKeyEntity | null> {
    const instance = await this.model.findByPk(id);
    if (!instance) {
      return null;
    }
    await instance.update({ processingState: "failed" });
    return toEntity(instance);
  }
}
