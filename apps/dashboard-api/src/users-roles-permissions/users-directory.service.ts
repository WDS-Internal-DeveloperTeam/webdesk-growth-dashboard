import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  RoleRepository,
  UserEntity,
  UserRepository,
  UserRoleRepository,
} from "@webdesk/database";
import { USER_REPOSITORY } from "../auth/config/auth.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { SessionService } from "../auth/session/session.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- same reason as SessionService above.
import { AuditService } from "../audit/audit.service.js";
import { ROLE_REPOSITORY, USER_ROLE_REPOSITORY } from "../authz/authz.constants.js";
import type { ListUsersQueryDto } from "./users-roles-permissions.dto.js";

export interface UserRoleAssignmentSummary {
  readonly roleId: string;
  readonly roleKey: string;
  readonly roleName: string;
  readonly projectId: string | null;
}

export interface UserDetail {
  readonly user: UserEntity;
  readonly roleAssignments: readonly UserRoleAssignmentSummary[];
}

/**
 * The "Users, Roles and Permissions" module's user-directory half (module registry key
 * `users_roles_permissions`) — a real admin surface (list/search every user regardless of status,
 * view a single user's full detail including every role assignment, activate/deactivate a user)
 * layered on top of the already-built RBAC core (Phase 1D), not a redesign of it. Deliberately
 * distinct from `UsersModule`'s `UsersService`, which is a picker-only, active-only lookup for
 * owner/team/approver assignment UIs (`users.module.ts`'s own doc comment names this module as
 * its own, separate, not-yet-authorized scope — this is that authorization).
 */
@Injectable()
export class UsersDirectoryService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(USER_ROLE_REPOSITORY) private readonly userRoles: UserRoleRepository,
    @Inject(ROLE_REPOSITORY) private readonly roles: RoleRepository,
    private readonly sessionService: SessionService,
    private readonly auditService: AuditService,
  ) {}

  async listUsers(
    query: ListUsersQueryDto,
  ): Promise<{ rows: readonly UserEntity[]; total: number }> {
    return this.users.listAll({
      search: query.search,
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
  }

  /**
   * Fetches the full role-assignment history — global scope plus every project-scoped
   * assignment — and resolves each `roleId` to its `key`/`name` in memory against one
   * `RoleRepository.listAll()` call (the 7 roles are seeded and small; this avoids an N+1 query
   * per assignment). Returns `null` for a nonexistent user, letting the caller decide the 404.
   */
  async getUserDetail(userId: string): Promise<UserDetail | null> {
    const user = await this.users.findById(userId);
    if (!user) {
      return null;
    }
    const [assignments, roles] = await Promise.all([
      this.userRoles.listForUser(userId),
      this.roles.listAll(),
    ]);
    const rolesById = new Map(roles.map((role) => [role.id, role]));
    const roleAssignments = assignments
      .map((assignment) => {
        const role = rolesById.get(assignment.roleId);
        if (!role) {
          return null;
        }
        return {
          roleId: role.id,
          roleKey: role.key,
          roleName: role.name,
          projectId: assignment.projectId,
        } satisfies UserRoleAssignmentSummary;
      })
      .filter((entry): entry is UserRoleAssignmentSummary => entry !== null);
    return { user, roleAssignments };
  }

  /**
   * Activates or deactivates a user. Rejects self-deactivation outright (a real safety rule
   * preventing self-lockout — a caller can always deactivate someone else, never themselves) with
   * a clean `BadRequestException` rather than letting it silently succeed and strand the actor
   * with no way to reverse their own change. On a real transition to `disabled`, also revokes every
   * existing session for the target user (`"admin-forced"`, mirroring
   * `RoleAssignmentService.assignRole()`'s own session-revocation-on-role-change precedent) so a
   * deactivated account can't keep operating on an outstanding session.
   *
   * The `audit_events` write is best-effort: wrapped in try/catch and only `console.error`'d on
   * failure, never rolled back or retried — the byte-identical, already-accepted pattern
   * `DesignReviewsService.decide()`/`ReviewsService.decide()` both already use for an audit write
   * that follows a real, already-committed state mutation.
   */
  async updateStatus(
    userId: string,
    targetStatus: "active" | "disabled",
    actorUserId: string,
  ): Promise<UserEntity> {
    const target = await this.users.findById(userId);
    if (!target) {
      throw new NotFoundException(`User not found: ${userId}`);
    }
    if (actorUserId === userId && targetStatus === "disabled") {
      throw new BadRequestException("Cannot deactivate your own account.");
    }

    const beforeStatus = target.accountStatus;
    const updated = await this.users.updateStatus(userId, targetStatus);
    if (!updated) {
      throw new NotFoundException(`User not found: ${userId}`);
    }

    if (updated.accountStatus === "disabled") {
      await this.sessionService.revokeAllForUser(userId, "admin-forced", new Date());
    }

    try {
      await this.auditService.record({
        eventType: targetStatus === "disabled" ? "user_deactivation" : "user_activation",
        actorUserId,
        actorType: "human",
        entityType: "user",
        entityId: userId,
        action: "update_status",
        beforeState: { accountStatus: beforeStatus },
        afterState: { accountStatus: updated.accountStatus },
        retentionCategory: "approval-audit-7y",
      });
    } catch (error) {
      console.error(
        `User ${userId} status change to "${targetStatus}" committed, but recording its audit event failed:`,
        error,
      );
    }

    return updated;
  }
}
