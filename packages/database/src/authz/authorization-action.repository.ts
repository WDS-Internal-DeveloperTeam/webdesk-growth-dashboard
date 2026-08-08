import type { Model } from "sequelize";
import { getAuthzModels } from "./models.js";
import type { AuthorizationActionEntity } from "./entities.js";

function toEntity(instance: Model): AuthorizationActionEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    actorId: json.actorId as string,
    actionType: json.actionType as string,
    resourceType: json.resourceType as string,
    resourceId: json.resourceId as string,
    occurredAt: (json.occurredAt as Date).toISOString(),
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

/**
 * Append-only by construction (one write method, `record` — no `update`/`delete`), same pattern
 * as `AuthEventRepository`. The reusable foundation future workflow modules write to so
 * `SeparationOfDutiesService.assertNoPriorConflictingAction()` can enforce e.g. "reviewer ≠
 * implementer" once those workflows exist — see migration 00017's own doc comment.
 */
export class AuthorizationActionRepository {
  private readonly model = getAuthzModels().AuthorizationAction;

  async record(input: {
    actorId: string;
    actionType: string;
    resourceType: string;
    resourceId: string;
    occurredAt?: Date;
  }): Promise<AuthorizationActionEntity> {
    const instance = await this.model.create({
      actorId: input.actorId,
      actionType: input.actionType,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      occurredAt: input.occurredAt ?? new Date(),
    });
    return toEntity(instance);
  }

  /** Every actor who performed `actionType` on this specific resource — the primary input to a prior-actor SoD check. */
  async findActorsForResource(
    resourceType: string,
    resourceId: string,
    actionType: string,
  ): Promise<readonly string[]> {
    const rows = await this.model.findAll({
      where: { resourceType, resourceId, actionType },
      attributes: ["actorId"],
    });
    return [...new Set(rows.map((row) => row.get("actorId") as string))];
  }
}
