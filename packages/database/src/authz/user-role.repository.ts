import type { Model } from "sequelize";
import { getAuthzModels } from "./models.js";
import type { UserRoleEntity } from "./entities.js";

function toEntity(instance: Model): UserRoleEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    userId: json.userId as string,
    roleId: json.roleId as string,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

export class UserRoleRepository {
  private readonly model = getAuthzModels().UserRole;

  async findRoleIdsForUser(userId: string): Promise<readonly string[]> {
    const rows = await this.model.findAll({ where: { userId }, attributes: ["roleId"] });
    return rows.map((row) => row.get("roleId") as string);
  }

  async listForUser(userId: string): Promise<readonly UserRoleEntity[]> {
    const rows = await this.model.findAll({ where: { userId } });
    return rows.map(toEntity);
  }

  async hasRole(userId: string, roleId: string): Promise<boolean> {
    const instance = await this.model.findOne({ where: { userId, roleId } });
    return instance !== null;
  }

  async assign(userId: string, roleId: string): Promise<UserRoleEntity> {
    const instance = await this.model.create({ userId, roleId });
    return toEntity(instance);
  }

  /** Returns whether a row was actually removed (idempotent — revoking a role the user doesn't hold is not an error). */
  async revoke(userId: string, roleId: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { userId, roleId } });
    return count > 0;
  }
}
