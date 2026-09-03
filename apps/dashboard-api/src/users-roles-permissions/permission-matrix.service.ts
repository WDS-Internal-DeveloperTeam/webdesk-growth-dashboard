import { Inject, Injectable } from "@nestjs/common";
import type { RolePermissionRepository } from "@webdesk/database";
import type { ModuleSummary, RoleSummary } from "@webdesk/shared-types";
import { ROLE_PERMISSION_REPOSITORY } from "../authz/authz.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { RoleAssignmentService } from "../authz/role-assignment.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- same reason as RoleAssignmentService above.
import { CatalogService } from "../authz/catalog.service.js";

export interface PermissionMatrixGrant {
  readonly roleId: string;
  readonly moduleId: string;
  readonly action: string;
}

export interface PermissionMatrix {
  readonly roles: readonly RoleSummary[];
  readonly modules: readonly ModuleSummary[];
  readonly grants: readonly PermissionMatrixGrant[];
}

/**
 * The "Users, Roles and Permissions" module's other half — a read-only viewer over the real
 * seeded RBAC matrix (`06_Roles_and_Permissions.md §3`): all 7 roles × all 21 permission-group
 * modules × every global-scope (`project_id IS NULL`) grant. Deliberately read-only — the matrix
 * itself stays migration-seeded; this module does not add a grant-editing endpoint (out of
 * scope, confirmed with the project owner before building).
 *
 * Reuses `RoleAssignmentService.listRoles()`/`CatalogService.listPermissionGroups()` (both
 * exported by `AuthzModule`, the same already-read-only services `AuthzModule`'s own
 * `RoleAssignmentController`/`CatalogController` already expose) instead of re-injecting
 * `RoleRepository`/`ModuleRepository` directly and re-implementing an independent `{id,key,name}`
 * mapper for each — the exact duplicated-mapping shape a code review on this branch flagged.
 * `CatalogService.listPermissionGroups()` already returns the precise `ModuleSummary` shape this
 * matrix needs, so no re-mapping is needed for modules at all; `RoleAssignmentService.listRoles()`
 * still returns the full `RoleEntity` (it has other, non-summary callers), so one small inline
 * `{id,key,name}` projection remains for roles — the same shape
 * `role-assignment.controller.ts#toSummary()` already uses for its own HTTP response, just not
 * extracted into a shared helper: with the module-mapping duplicate now gone, this is the only
 * mapper left, so there's nothing left to de-duplicate it against within this file.
 *
 * `listAllGlobalGrants()` has no equivalent service-level read anywhere else in this codebase, so
 * `RolePermissionRepository` is still injected directly for it — reusing an existing service isn't
 * possible when none exists.
 */
@Injectable()
export class PermissionMatrixService {
  constructor(
    private readonly roleAssignment: RoleAssignmentService,
    private readonly catalog: CatalogService,
    @Inject(ROLE_PERMISSION_REPOSITORY) private readonly rolePermissions: RolePermissionRepository,
  ) {}

  async getMatrix(): Promise<PermissionMatrix> {
    const [roles, modules, grants] = await Promise.all([
      this.roleAssignment.listRoles(),
      this.catalog.listPermissionGroups(),
      this.rolePermissions.listAllGlobalGrants(),
    ]);
    return {
      roles: roles.map((role) => ({ id: role.id, key: role.key, name: role.name })),
      modules,
      grants: grants.map((grant) => ({
        roleId: grant.roleId,
        moduleId: grant.moduleId,
        action: grant.action,
      })),
    };
  }
}
