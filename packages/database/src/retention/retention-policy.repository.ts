import type { Model } from "sequelize";
import { getRetentionModels } from "./models.js";
import type { RetentionPolicyEntity, RetentionUnit } from "./entities.js";

function toEntity(instance: Model): RetentionPolicyEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    categoryKey: json.categoryKey as string,
    displayName: json.displayName as string,
    retentionValue: json.retentionValue as number,
    retentionUnit: json.retentionUnit as RetentionUnit,
    anchor: json.anchor as string,
    description: (json.description as string | null) ?? null,
    appliesToEntityType: (json.appliesToEntityType as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

/** Read-only from the application's perspective — the 25 approved categories are seeded by migration `00021`, not created via this repository. */
export class RetentionPolicyRepository {
  private readonly model = getRetentionModels().RetentionPolicy;

  async findByCategoryKey(categoryKey: string): Promise<RetentionPolicyEntity | null> {
    const instance = await this.model.findOne({ where: { categoryKey } });
    return instance ? toEntity(instance) : null;
  }

  async listAll(): Promise<readonly RetentionPolicyEntity[]> {
    const rows = await this.model.findAll({ order: [["categoryKey", "ASC"]] });
    return rows.map(toEntity);
  }
}
