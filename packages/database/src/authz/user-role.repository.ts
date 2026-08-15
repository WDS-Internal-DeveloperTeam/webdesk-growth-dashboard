import { Op, type Model } from "sequelize";
import { getAuthzModels } from "./models.js";
import type { UserRoleEntity } from "./entities.js";

function toEntity(instance: Model): UserRoleEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    userId: json.userId as string,
    roleId: json.roleId as string,
    projectId: (json.projectId as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

export class UserRoleRepository {
  private readonly model = getAuthzModels().UserRole;

  /**
   * Role ids held by a user at global scope (`project_id IS NULL`) plus, when `projectId` is
   * given, role ids additionally held scoped to that specific project — never the other way
   * around (a grant scoped to project A never applies inside project B). Migration 00016.
   */
  async findRoleIdsForUser(userId: string, projectId?: string): Promise<readonly string[]> {
    const rows = await this.model.findAll({
      where: {
        userId,
        // NOT `{ [Op.in]: [null, projectId] }` — SQL's `IN` never matches NULL (three-valued
        // logic), so that form silently excluded every global-scope role the instant a real
        // `projectId` was passed. Previously dormant (no project-scoped route existed to exercise
        // it) — the Projects module's `:projectId` routes are the first
        // (docs/task-packages/module-projects-foundation.md).
        ...(projectId ? { [Op.or]: [{ projectId: null }, { projectId }] } : { projectId: null }),
      },
      attributes: ["roleId"],
    });
    return rows.map((row) => row.get("roleId") as string);
  }

  async listForUser(userId: string): Promise<readonly UserRoleEntity[]> {
    const rows = await this.model.findAll({ where: { userId } });
    return rows.map(toEntity);
  }

  async hasRole(userId: string, roleId: string, projectId: string | null = null): Promise<boolean> {
    const instance = await this.model.findOne({ where: { userId, roleId, projectId } });
    return instance !== null;
  }

  async assign(
    userId: string,
    roleId: string,
    projectId: string | null = null,
  ): Promise<UserRoleEntity> {
    const instance = await this.model.create({ userId, roleId, projectId });
    return toEntity(instance);
  }

  /** Returns whether a row was actually removed (idempotent — revoking a role the user doesn't hold is not an error). */
  async revoke(userId: string, roleId: string, projectId: string | null = null): Promise<boolean> {
    const count = await this.model.destroy({ where: { userId, roleId, projectId } });
    return count > 0;
  }

  /** True if any user (at any project scope) currently holds this role — the Super Admin bootstrap gate's own "no authorized administrator exists yet" check. */
  async anyUserHoldsRole(roleId: string): Promise<boolean> {
    const instance = await this.model.findOne({ where: { roleId } });
    return instance !== null;
  }
}
