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

  /**
   * True if ANY of `roleIds` has a global-scope (`project_id IS NULL`) grant for `moduleId`+`action`,
   * OR — when `projectId` is given — a grant scoped to that specific project. A grant scoped to a
   * *different* project never matches (migration 00016's project-scoping axis).
   */
  async hasGrant(
    roleIds: readonly string[],
    moduleId: string,
    action: string,
    projectId?: string,
  ): Promise<boolean> {
    if (roleIds.length === 0) {
      return false;
    }
    const instance = await this.model.findOne({
      where: {
        roleId: { [Op.in]: [...roleIds] },
        moduleId,
        action,
        // NOT `{ [Op.in]: [null, projectId] }` — SQL's `IN` never matches NULL (three-valued
        // logic: `col = NULL` is UNKNOWN, not TRUE), so that form silently excluded every
        // global-scope grant the instant a real `projectId` was passed. Previously dormant
        // (docs/security/threat-model-authorization-rbac.md's accepted-gaps list) because no
        // project-scoped route existed to exercise it — the Projects module's `:projectId` routes
        // are the first (docs/task-packages/module-projects-foundation.md).
        ...(projectId ? { [Op.or]: [{ projectId: null }, { projectId }] } : { projectId: null }),
      },
    });
    return instance !== null;
  }

  async listForRole(roleId: string): Promise<readonly RolePermissionEntity[]> {
    const rows = await this.model.findAll({ where: { roleId } });
    return rows.map(toEntity);
  }

  /**
   * Every grant (global-scope, plus project-scoped when `projectId` is given) held by ANY of
   * `roleIds` — one query, not one per module/action, per task package §28's own "avoid N+1
   * permission queries" instruction. The primary input to `/me/capabilities` (task package §20).
   */
  async listGrantsForRoles(
    roleIds: readonly string[],
    projectId?: string,
  ): Promise<readonly RolePermissionEntity[]> {
    if (roleIds.length === 0) {
      return [];
    }
    const rows = await this.model.findAll({
      where: {
        roleId: { [Op.in]: [...roleIds] },
        // Same NULL/IN fix as hasGrant() above.
        ...(projectId ? { [Op.or]: [{ projectId: null }, { projectId }] } : { projectId: null }),
      },
    });
    return rows.map(toEntity);
  }
}
