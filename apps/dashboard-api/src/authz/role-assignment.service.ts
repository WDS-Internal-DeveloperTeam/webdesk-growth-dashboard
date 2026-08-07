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
import { ROLE_REPOSITORY, USER_ROLE_REPOSITORY } from "./authz.constants.js";

/**
 * The "Users/roles" module (`06_Roles_and_Permissions.md §3`) itself —
 * gated by the same `PermissionGuard`/`@RequirePermission("users_roles",
 * ...)` mechanism this phase builds, not a special-cased bootstrap path.
 * A role change revokes the affected user's existing sessions immediately
 * (`SessionService.revokeAllForUser`, `"role-change"`) — knowledge/12's
 * "Operational considerations": a demoted/promoted user's outstanding
 * session must not keep operating under the stale permission set.
 */
@Injectable()
export class RoleAssignmentService {
  constructor(
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    @Inject(USER_ROLE_REPOSITORY) private readonly userRoles: UserRoleRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(AUTH_EVENT_REPOSITORY) private readonly events: AuthEventRepository,
    private readonly sessionService: SessionService,
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
