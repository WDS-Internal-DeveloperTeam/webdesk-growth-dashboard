import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { RoleRepository } from "@webdesk/database";
import { ROLE_REPOSITORY } from "../authz/authz.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { RoleAssignmentService } from "../authz/role-assignment.service.js";

const APPROVER_ROLE_KEY = "owner_growth_approver";

/**
 * "Define approvers" (task package §7, design decision D4) — no document names a Projects-specific
 * approval role distinct from the already-existing `owner_growth_approver`, so this reuses that
 * role, scoped to the project via the existing `user_roles.project_id` mechanism, rather than
 * inventing a new one. Delegates to the already-reviewed `RoleAssignmentService` (separation-of-
 * duties check, session revocation, audit event) instead of writing to `user_roles` directly —
 * task package rule 6: "no self-invented authorization mechanism."
 */
@Injectable()
export class ProjectApproversService {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    private readonly roleAssignment: RoleAssignmentService,
  ) {}

  async assign(projectId: string, userId: string, actorId: string): Promise<void> {
    const role = await this.roles.findByKey(APPROVER_ROLE_KEY);
    if (!role) {
      throw new NotFoundException(`Role not seeded: ${APPROVER_ROLE_KEY}`);
    }
    await this.roleAssignment.assignRole(userId, role.id, actorId, new Date(), projectId);
  }
}
