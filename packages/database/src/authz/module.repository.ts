import type { Model } from "sequelize";
import { getAuthzModels } from "./models.js";
import type { ModuleEntity } from "./entities.js";

function toEntity(instance: Model): ModuleEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    key: json.key as string,
    name: json.name as string,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

/** The 21 module keys are seeded (packages/database/src/migrations/00013) — a module row existing does not imply its own feature/endpoints exist yet, see docs/task-packages/phase-1d-rbac-authorization.md §5. */
export class ModuleRepository {
  private readonly model = getAuthzModels().Module;

  async findById(id: string): Promise<ModuleEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntity(instance) : null;
  }

  async findByKey(key: string): Promise<ModuleEntity | null> {
    const instance = await this.model.findOne({ where: { key } });
    return instance ? toEntity(instance) : null;
  }

  async listAll(): Promise<readonly ModuleEntity[]> {
    const rows = await this.model.findAll({ order: [["name", "ASC"]] });
    return rows.map(toEntity);
  }
}
