import { Inject, Injectable } from "@nestjs/common";
import type { ModuleRepository, RolePermissionRepository, RoleRepository } from "@webdesk/database";
import {
  MODULE_REPOSITORY,
  ROLE_PERMISSION_REPOSITORY,
  ROLE_REPOSITORY,
} from "../authz/authz.constants.js";

export interface PermissionMatrixRole {
  readonly id: string;
  readonly key: string;
  readonly name: string;
}

export interface PermissionMatrixModule {
  readonly id: string;
  readonly key: string;
  readonly name: string;
}

export interface PermissionMatrixGrant {
  readonly roleId: string;
  readonly moduleId: string;
  readonly action: string;
}

export interface PermissionMatrix {
  readonly roles: readonly PermissionMatrixRole[];
  readonly modules: readonly PermissionMatrixModule[];
  readonly grants: readonly PermissionMatrixGrant[];
}

/**
 * The "Users, Roles and Permissions" module's other half — a read-only viewer over the real
 * seeded RBAC matrix (`06_Roles_and_Permissions.md §3`): all 7 roles × all 21 permission-group
 * modules × every global-scope (`project_id IS NULL`) grant. Deliberately read-only — the matrix
 * itself stays migration-seeded; this module does not add a grant-editing endpoint (out of
 * scope, confirmed with the project owner before building).
 */
@Injectable()
export class PermissionMatrixService {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(MODULE_REPOSITORY) private readonly modules: ModuleRepository,
    @Inject(ROLE_PERMISSION_REPOSITORY) private readonly rolePermissions: RolePermissionRepository,
  ) {}

  async getMatrix(): Promise<PermissionMatrix> {
    const [roles, modules, grants] = await Promise.all([
      this.roles.listAll(),
      this.modules.listAll(),
      this.rolePermissions.listAllGlobalGrants(),
    ]);
    return {
      roles: roles.map((role) => ({ id: role.id, key: role.key, name: role.name })),
      modules: modules.map((module) => ({ id: module.id, key: module.key, name: module.name })),
      grants: grants.map((grant) => ({
        roleId: grant.roleId,
        moduleId: grant.moduleId,
        action: grant.action,
      })),
    };
  }
}
