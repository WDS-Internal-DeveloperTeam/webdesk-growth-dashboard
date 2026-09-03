import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
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
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- same reason as SessionService above.
import { SeparationOfDutiesService } from "../auth/common/separation-of-duties.service.js";
import { ROLE_REPOSITORY, USER_ROLE_REPOSITORY } from "../authz/authz.constants.js";
import type { ListUsersQueryDto } from "./users-roles-permissions.dto.js";

/** The seeded role key this module's last-active-Super-Admin lockout guard checks against. */
const SUPER_ADMIN_ROLE_KEY = "super_admin";

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
    private readonly separationOfDuties: SeparationOfDutiesService,
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
   * Activates or deactivates a user. Rejects self-deactivation outright via
   * `SeparationOfDutiesService.assertDistinctActors()` — the same reusable primitive
   * `RoleAssignmentService.assertNotSelfTargeting()` already uses for the identical "actor can't
   * target themselves" shape, rather than a hand-rolled equality check — so a denial also
   * automatically records a `security_exception` audit event and throws the same
   * `ForbiddenException` (403) every other self-targeting denial in this codebase does, instead of
   * a one-off `BadRequestException` (400). Also rejects deactivating the last remaining active
   * Super Admin (`assertNotSoleActiveSuperAdmin()` below) — a real, easily-triggered lockout risk.
   * Only self-activation stays unguarded — reactivating your own already-disabled account isn't
   * the same self-targeting risk (you can't be mid-request revoking your own live session while
   * also restoring it).
   *
   * On a real transition to `disabled`, also revokes every existing session for the target user
   * (`"admin-forced"`, mirroring `RoleAssignmentService.assignRole()`'s own
   * session-revocation-on-role-change precedent) so a deactivated account can't keep operating on
   * an outstanding session.
   *
   * `UserRepository.updateStatus()`'s CAS guard (`expectedStatus`, set to the status just read via
   * `findById()`) means a `null` result here can only mean a concurrent write raced this one — the
   * row was already confirmed to exist a moment ago — so it's reported as a `ConflictException`
   * (409), not the misleading `NotFoundException` a "row doesn't exist" case would need.
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

    if (targetStatus === "disabled") {
      await this.separationOfDuties.assertDistinctActors(
        actorUserId,
        userId,
        "user deactivation actor",
        { entityType: "user", entityId: userId, retentionCategory: "approval-audit-7y" },
      );
      await this.assertNotSoleActiveSuperAdmin(userId);
    }

    const beforeStatus = target.accountStatus;
    const updated = await this.users.updateStatus(userId, targetStatus, beforeStatus);
    if (!updated) {
      throw new ConflictException(`User ${userId}'s status changed concurrently — please retry.`);
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

  /**
   * Guards against deactivating the last remaining active Super Admin account. This module is the
   * first HTTP-reachable path that makes that lockout trivially easy to trigger — the pre-existing
   * `RoleAssignmentService.revokeRole()` has the identical unaddressed gap at the role-revocation
   * layer (revoking a user's last `super_admin` grant leaves the same organization-wide lockout
   * risk), left unfixed here as a separate, out-of-scope concern for a fix round on this module.
   *
   * The expensive "who else holds this role" lookup (2 more queries) only runs once the target is
   * confirmed to actually hold `super_admin` at global scope — a cheap membership check first
   * (resolving the role's id, then checking it against the target's own global role-id list) means
   * deactivating any non-admin user pays only that lightweight check, not the full lookup.
   */
  private async assertNotSoleActiveSuperAdmin(userId: string): Promise<void> {
    const superAdminRole = await this.roles.findByKey(SUPER_ADMIN_ROLE_KEY);
    if (!superAdminRole) {
      // Defensive only — the role is always seeded; nothing to guard if it somehow doesn't exist.
      return;
    }
    const targetGlobalRoleIds = await this.userRoles.findRoleIdsForUser(userId);
    if (!targetGlobalRoleIds.includes(superAdminRole.id)) {
      return;
    }
    const holderIds = await this.userRoles.findUserIdsForGlobalRole(superAdminRole.id);
    const otherHolderIds = holderIds.filter((id) => id !== userId);
    // UserRepository.findByIds() already filters to accountStatus: "active" — exactly the
    // "still-active other holder" check this guard needs, no separate status filter required.
    const otherActiveHolders = await this.users.findByIds(otherHolderIds);
    if (otherActiveHolders.length === 0) {
      throw new ConflictException("Cannot deactivate the last active Super Admin account.");
    }
  }
}
