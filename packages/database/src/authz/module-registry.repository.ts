import type { Model } from "sequelize";
import { getAuthzModels } from "./models.js";
import type { ModuleRegistryEntity } from "./entities.js";

function toEntity(instance: Model): ModuleRegistryEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    key: json.key as string,
    name: json.name as string,
    permissionGroupId: json.permissionGroupId as string,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

/** The 43 real dashboard modules (migrations 00014/00015) — never created via this repository; only the seed migration writes rows. */
export class ModuleRegistryRepository {
  private readonly model = getAuthzModels().ModuleRegistry;

  async findByKey(key: string): Promise<ModuleRegistryEntity | null> {
    const instance = await this.model.findOne({ where: { key } });
    return instance ? toEntity(instance) : null;
  }

  async listAll(): Promise<readonly ModuleRegistryEntity[]> {
    const rows = await this.model.findAll({ order: [["name", "ASC"]] });
    return rows.map(toEntity);
  }
}
