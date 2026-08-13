import type { Model } from "sequelize";
import { getSystemOperationsModels } from "./models.js";
import type { SystemComponentEntity } from "./entities.js";

function toEntity(instance: Model): SystemComponentEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    key: json.key as string,
    displayName: json.displayName as string,
    description: (json.description as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

/** Read-only from the application's perspective — the 10 approved components are seeded by migration `00021`, not created via this repository. */
export class SystemComponentRepository {
  private readonly model = getSystemOperationsModels().SystemComponent;

  async findByKey(key: string): Promise<SystemComponentEntity | null> {
    const instance = await this.model.findOne({ where: { key } });
    return instance ? toEntity(instance) : null;
  }

  async listAll(): Promise<readonly SystemComponentEntity[]> {
    const rows = await this.model.findAll({ order: [["key", "ASC"]] });
    return rows.map(toEntity);
  }
}
