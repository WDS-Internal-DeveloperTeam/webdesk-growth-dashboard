import type { Model } from "sequelize";
import { getAuthzModels } from "./models.js";
import type { RoleEntity } from "./entities.js";

function toEntity(instance: Model): RoleEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    key: json.key as string,
    name: json.name as string,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

/** The 7 roles are seeded (packages/database/src/migrations/00013) — this repository never creates one; only the "Users/roles" module's own list/assign endpoints read from it. */
export class RoleRepository {
  private readonly model = getAuthzModels().Role;

  async findById(id: string): Promise<RoleEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntity(instance) : null;
  }

  async findByKey(key: string): Promise<RoleEntity | null> {
    const instance = await this.model.findOne({ where: { key } });
    return instance ? toEntity(instance) : null;
  }

  async listAll(): Promise<readonly RoleEntity[]> {
    const rows = await this.model.findAll({ order: [["name", "ASC"]] });
    return rows.map(toEntity);
  }
}
