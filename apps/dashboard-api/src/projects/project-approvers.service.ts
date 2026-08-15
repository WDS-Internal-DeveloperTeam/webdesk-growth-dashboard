import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { RoleRepository } from "@webdesk/database";
import { ROLE_REPOSITORY } from "../authz/authz.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { RoleAssignmentService } from "../authz/role-assignment.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- same reason as above.
import { AuthorizationService } from "../authz/authorization.service.js";

const APPROVER_ROLE_KEY = "owner_growth_approver";
const ROLE_MANAGEMENT_MODULE_KEY = "users_roles";
const ROLE_MANAGEMENT_ACTION = "edit";

/**
 * "Define approvers" (task package §7, design decision D4) — no document names a Projects-specific
 * approval role distinct from the already-existing `owner_growth_approver`, so this reuses that
 * role, scoped to the project via the existing `user_roles.project_id` mechanism, rather than
 * inventing a new one. Delegates to the already-reviewed `RoleAssignmentService` (separation-of-
 * duties check, session revocation, audit event) instead of writing to `user_roles` directly —
 * task package rule 6: "no self-invented authorization mechanism."
 *
 * The route above this service is gated by `project_configuration:approve`, which
 * `owner_growth_approver` itself holds — but minting a new RBAC grant is a `users_roles` action,
 * not a `project_configuration` one, and the approved matrix (`06_Roles_and_Permissions.md §3`)
 * deliberately withholds `users_roles:edit` from `owner_growth_approver` (only `VM`, no `E`).
 * Without this explicit second check, any `owner_growth_approver` could mint more co-approvers via
 * this endpoint despite never holding role-management rights (security-review finding, this
 * branch) — so `assign()` re-checks `users_roles:edit` itself before delegating, the same
 * enforcement `PermissionGuard` performs at the route level, just for the permission this specific
 * side effect actually requires.
 */
@Injectable()
export class ProjectApproversService {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    private readonly roleAssignment: RoleAssignmentService,
    private readonly authorization: AuthorizationService,
  ) {}

  async assign(projectId: string, userId: string, actorId: string): Promise<void> {
    const decision = await this.authorization.evaluate(
      actorId,
      ROLE_MANAGEMENT_MODULE_KEY,
      ROLE_MANAGEMENT_ACTION,
      projectId,
    );
    if (!decision.allowed) {
      await this.authorization.recordAccessDenied(
        actorId,
        ROLE_MANAGEMENT_MODULE_KEY,
        ROLE_MANAGEMENT_ACTION,
        decision.reasonCode!,
      );
      throw new ForbiddenException(
        `Missing permission: ${ROLE_MANAGEMENT_MODULE_KEY}:${ROLE_MANAGEMENT_ACTION}`,
      );
    }

    const role = await this.roles.findByKey(APPROVER_ROLE_KEY);
    if (!role) {
      throw new NotFoundException(`Role not seeded: ${APPROVER_ROLE_KEY}`);
    }
    await this.roleAssignment.assignRole(userId, role.id, actorId, new Date(), projectId);
  }
}
