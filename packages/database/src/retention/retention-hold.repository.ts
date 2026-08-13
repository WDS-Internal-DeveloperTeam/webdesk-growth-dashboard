import type { Model } from "sequelize";
import { getRetentionModels } from "./models.js";
import type { RetentionHoldEntity, RetentionHoldScope } from "./entities.js";

function toEntity(instance: Model): RetentionHoldEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    scope: json.scope as RetentionHoldScope,
    resourceType: (json.resourceType as string | null) ?? null,
    resourceId: (json.resourceId as string | null) ?? null,
    categoryKey: (json.categoryKey as string | null) ?? null,
    reasonCategory: json.reasonCategory as string,
    reason: json.reason as string,
    createdByUserId: json.createdByUserId as string,
    approvedByUserId: (json.approvedByUserId as string | null) ?? null,
    startDate: (json.startDate as Date).toISOString(),
    endDate: json.endDate ? (json.endDate as Date).toISOString() : null,
    status: json.status as RetentionHoldEntity["status"],
    releaseReason: (json.releaseReason as string | null) ?? null,
    releasedByUserId: (json.releasedByUserId as string | null) ?? null,
    releasedAt: json.releasedAt ? (json.releasedAt as Date).toISOString() : null,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

export class RetentionHoldRepository {
  private readonly model = getRetentionModels().RetentionHold;

  async create(input: {
    scope: RetentionHoldScope;
    resourceType?: string | null;
    resourceId?: string | null;
    categoryKey?: string | null;
    reasonCategory: string;
    reason: string;
    createdByUserId: string;
    approvedByUserId?: string | null;
    endDate?: Date | null;
  }): Promise<RetentionHoldEntity> {
    const instance = await this.model.create({
      scope: input.scope,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      categoryKey: input.categoryKey ?? null,
      reasonCategory: input.reasonCategory,
      reason: input.reason,
      createdByUserId: input.createdByUserId,
      approvedByUserId: input.approvedByUserId ?? null,
      endDate: input.endDate ?? null,
      status: "active",
    });
    return toEntity(instance);
  }

  async findById(id: string): Promise<RetentionHoldEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntity(instance) : null;
  }

  async findActiveForResource(
    resourceType: string,
    resourceId: string,
  ): Promise<readonly RetentionHoldEntity[]> {
    const rows = await this.model.findAll({
      where: { scope: "entity", resourceType, resourceId, status: "active" },
    });
    return rows.map(toEntity);
  }

  async findActiveForCategory(categoryKey: string): Promise<readonly RetentionHoldEntity[]> {
    const rows = await this.model.findAll({
      where: { scope: "category", categoryKey, status: "active" },
    });
    return rows.map(toEntity);
  }

  async listAll(
    filter: { status?: RetentionHoldEntity["status"] } = {},
  ): Promise<readonly RetentionHoldEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.status) {
      where.status = filter.status;
    }
    const rows = await this.model.findAll({ where, order: [["createdAt", "DESC"]] });
    return rows.map(toEntity);
  }

  /**
   * Requires a release reason — enforced here, not just at the service layer, so "silently
   * release a hold" (§21) has no code path even for a future direct caller of this repository.
   *
   * The update is conditional on `status = 'active'` (`WHERE id = :id AND status = 'active'`),
   * not a plain `findByPk` + `.update()` — the service layer reads the hold's status to decide
   * this release is valid, and without pinning that same status in the `WHERE` clause, two
   * concurrent `releaseHold` calls on the same hold could both pass that precondition check and
   * both "win", double-recording the release and letting the second call's reason silently
   * overwrite the first's. Returns `null` when the row doesn't exist OR when the conditional
   * update matched zero rows (already released under the caller) — `RetentionHoldService`
   * distinguishes the two by having already fetched the row itself before calling `release`.
   */
  async release(
    id: string,
    input: { releaseReason: string; releasedByUserId: string },
  ): Promise<RetentionHoldEntity | null> {
    const [affectedCount] = await this.model.update(
      {
        status: "released",
        releaseReason: input.releaseReason,
        releasedByUserId: input.releasedByUserId,
        releasedAt: new Date(),
      },
      { where: { id, status: "active" } },
    );
    if (affectedCount === 0) {
      return null;
    }
    const instance = await this.model.findByPk(id);
    return instance ? toEntity(instance) : null;
  }
}
