import { Inject, Injectable } from "@nestjs/common";
import type {
  ModuleRepository,
  RolePermissionRepository,
  UserRoleRepository,
} from "@webdesk/database";
import {
  MODULE_REPOSITORY,
  ROLE_PERMISSION_REPOSITORY,
  USER_ROLE_REPOSITORY,
} from "./authz.constants.js";

/**
 * ADR-0010 — deny-by-default RBAC. `can()` denies on every ambiguous or
 * unknown input (unknown module key, user with no roles, no grant row) —
 * there is no code path in this service that defaults to allow.
 */
@Injectable()
export class PermissionService {
  constructor(
    @Inject(MODULE_REPOSITORY) private readonly modules: ModuleRepository,
    @Inject(ROLE_PERMISSION_REPOSITORY) private readonly rolePermissions: RolePermissionRepository,
    @Inject(USER_ROLE_REPOSITORY) private readonly userRoles: UserRoleRepository,
  ) {}

  async can(userId: string, moduleKey: string, action: string): Promise<boolean> {
    const module = await this.modules.findByKey(moduleKey);
    if (!module) {
      return false;
    }
    const roleIds = await this.userRoles.findRoleIdsForUser(userId);
    if (roleIds.length === 0) {
      return false;
    }
    return this.rolePermissions.hasGrant(roleIds, module.id, action);
  }
}
