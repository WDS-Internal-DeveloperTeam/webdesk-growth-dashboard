import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AuthEventRepository,
  RoleEntity,
  RoleRepository,
  UserRepository,
  UserRoleRepository,
} from "@webdesk/database";
import { AUTH_EVENT_REPOSITORY, USER_REPOSITORY } from "../auth/config/auth.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { SessionService } from "../auth/session/session.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- same reason as SessionService above.
import { SeparationOfDutiesService } from "../auth/common/separation-of-duties.service.js";
import { ROLE_REPOSITORY, USER_ROLE_REPOSITORY } from "./authz.constants.js";

/**
 * The "Users/roles" module (`06_Roles_and_Permissions.md §3`) itself —
 * gated by the same `PermissionGuard`/`@RequirePermission("users_roles",
 * ...)` mechanism this phase builds, not a special-cased bootstrap path.
 * A role change revokes the affected user's existing sessions immediately
 * (`SessionService.revokeAllForUser`, `"role-change"`) — knowledge/12's
 * "Operational considerations": a demoted/promoted user's outstanding
 * session must not keep operating under the stale permission set.
 *
 * **Self-role-assignment is blocked** (`SeparationOfDutiesService`) — a
 * user can never assign or revoke their own role, even a Super Admin.
 * This resolves the gap `docs/security/threat-model-authorization-rbac.md`
 * flagged as an open decision for the second-role reviewer in PR #8 — it
 * is being closed now because
 * `docs/task-packages/phase-1d-rbac-permissions-expanded.md` §21/§33
 * explicitly directs it ("Do not allow self-assignment of privileged
 * roles"), i.e. per the user's own explicit instruction in this brief,
 * not a unilateral decision made by the implementing agent. Every denial
 * records a `separation_of_duties_denied` auth event (§22's required
 * event vocabulary) before rethrowing.
 */
@Injectable()
export class RoleAssignmentService {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(USER_ROLE_REPOSITORY) private readonly userRoles: UserRoleRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(AUTH_EVENT_REPOSITORY) private readonly events: AuthEventRepository,
    private readonly sessionService: SessionService,
    private readonly separationOfDuties: SeparationOfDutiesService,
  ) {}

  async listRoles(): Promise<readonly RoleEntity[]> {
    return this.roles.listAll();
  }

  async listRolesForUser(userId: string): Promise<readonly RoleEntity[]> {
    await this.requireUser(userId);
    const roleIds = await this.userRoles.findRoleIdsForUser(userId);
    const resolved = await Promise.all(roleIds.map((id) => this.roles.findById(id)));
    return resolved.filter((role): role is RoleEntity => role !== null);
  }

  async assignRole(
    targetUserId: string,
    roleId: string,
    actorId: string,
    now = new Date(),
  ): Promise<void> {
    await this.assertNotSelfTargeting(actorId, targetUserId, "role-assignment actor");
    await this.requireUser(targetUserId);
    const role = await this.requireRole(roleId);

    if (await this.userRoles.hasRole(targetUserId, roleId)) {
      throw new ConflictException(`User already holds role: ${role.key}`);
    }

    await this.userRoles.assign(targetUserId, roleId);
    await this.events.record({
      eventType: "role_assigned",
      userId: targetUserId,
      success: true,
      reason: `role:${role.key} assigned_by:${actorId}`,
    });
    await this.sessionService.revokeAllForUser(targetUserId, "role-change", now);
  }

  async revokeRole(
    targetUserId: string,
    roleId: string,
    actorId: string,
    now = new Date(),
  ): Promise<void> {
    await this.assertNotSelfTargeting(actorId, targetUserId, "role-revocation actor");
    await this.requireUser(targetUserId);
    const role = await this.requireRole(roleId);

    const removed = await this.userRoles.revoke(targetUserId, roleId);
    if (!removed) {
      return;
    }
    await this.events.record({
      eventType: "role_revoked",
      userId: targetUserId,
      success: true,
      reason: `role:${role.key} revoked_by:${actorId}`,
    });
    await this.sessionService.revokeAllForUser(targetUserId, "role-change", now);
  }

  /** Wraps `SeparationOfDutiesService.assertDistinctActors`: on denial, records a `separation_of_duties_denied` event (§22) before rethrowing, so the block itself is auditable. */
  private async assertNotSelfTargeting(
    actorId: string,
    targetUserId: string,
    context: string,
  ): Promise<void> {
    try {
      this.separationOfDuties.assertDistinctActors(actorId, targetUserId, context);
    } catch (error) {
      await this.events.record({
        eventType: "separation_of_duties_denied",
        userId: actorId,
        success: false,
        reason: `context:${context} target:${targetUserId}`,
      });
      throw error;
    }
  }

  private async requireUser(userId: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new NotFoundException(`User not found: ${userId}`);
    }
  }

  private async requireRole(roleId: string): Promise<RoleEntity> {
    const role = await this.roles.findById(roleId);
    if (!role) {
      throw new NotFoundException(`Role not found: ${roleId}`);
    }
    return role;
  }
}
