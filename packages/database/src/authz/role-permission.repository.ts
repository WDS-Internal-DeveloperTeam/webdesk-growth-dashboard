import { Op, type Model } from "sequelize";
import { getAuthzModels } from "./models.js";
import type { RolePermissionEntity } from "./entities.js";

function toEntity(instance: Model): RolePermissionEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    roleId: json.roleId as string,
    moduleId: json.moduleId as string,
    action: json.action as string,
    projectId: (json.projectId as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

/**
 * Deliberately mechanical (same discipline as
 * packages/database/src/auth/auth-lockout-state.repository.ts) — the
 * "does this user have permission" orchestration (resolve user → role
 * IDs → grant check) is business logic in
 * apps/dashboard-api/src/authz/permission.service.ts, not here.
 */
export class RolePermissionRepository {
  private readonly model = getAuthzModels().RolePermission;

  /** True if ANY of `roleIds` has a global-scope (`project_id IS NULL`) grant for `moduleId`+`action`. */
  async hasGrant(roleIds: readonly string[], moduleId: string, action: string): Promise<boolean> {
    if (roleIds.length === 0) {
      return false;
    }
    const instance = await this.model.findOne({
      where: {
        roleId: { [Op.in]: [...roleIds] },
        moduleId,
        action,
        projectId: null,
      },
    });
    return instance !== null;
  }

  async listForRole(roleId: string): Promise<readonly RolePermissionEntity[]> {
    const rows = await this.model.findAll({ where: { roleId } });
    return rows.map(toEntity);
  }
}
