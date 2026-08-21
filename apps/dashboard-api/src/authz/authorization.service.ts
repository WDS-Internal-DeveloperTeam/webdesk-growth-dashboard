import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
  AuthEventRepository,
  ModuleRepository,
  RolePermissionRepository,
  UserRepository,
  UserRoleRepository,
} from "@webdesk/database";
import { AUTH_EVENT_REPOSITORY, USER_REPOSITORY } from "../auth/config/auth.constants.js";
import {
  MODULE_REPOSITORY,
  ROLE_PERMISSION_REPOSITORY,
  USER_ROLE_REPOSITORY,
} from "./authz.constants.js";

export type DenialReasonCode =
  "unknown_module" | "user_not_found" | "user_disabled" | "no_roles" | "no_grant";

export interface AuthorizationDecision {
  readonly allowed: boolean;
  /** `null` when `allowed` is true — a grant needs no reason. */
  readonly reasonCode: DenialReasonCode | null;
}

const CONFIDENTIAL_VIEW_ACTION = "view_confidential";
const CONFIDENTIAL_EDIT_ACTION = "edit_confidential";

/**
 * The centralized authorization/policy service required by
 * docs/task-packages/phase-1d-rbac-permissions-expanded.md §13 —
 * **retires and replaces** the narrower `PermissionService` from PR #8
 * (deleted, not kept alongside this as a second, divergence-prone
 * implementation of the same grant check) by adding: active-user-status
 * resolution, project context, confidential-field resolution, a safe
 * machine-readable reason code, and a privileged-access-denial audit
 * event. §13's steps 7/8 (workflow/policy constraints, separation-of-duties
 * constraints) are deliberately NOT folded into `evaluate()` — no workflow
 * tables exist yet to evaluate constraints against (out of this phase's
 * scope), and self-contained SoD checks (e.g. role self-assignment) are a
 * distinct concern with a distinct actor/target shape that doesn't fit a
 * single `(userId, moduleKey, action)` call. See `SeparationOfDutiesService`
 * for that half of the architecture — callers needing both a permission
 * check and a SoD check (e.g. `RoleAssignmentService`) call both services,
 * per §13's own "centralized... layer" meaning one place per concern, not
 * one god-method.
 */
@Injectable()
export class AuthorizationService {
  constructor(
    @Inject(MODULE_REPOSITORY) private readonly modules: ModuleRepository,
    @Inject(ROLE_PERMISSION_REPOSITORY) private readonly rolePermissions: RolePermissionRepository,
    @Inject(USER_ROLE_REPOSITORY) private readonly userRoles: UserRoleRepository,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(AUTH_EVENT_REPOSITORY) private readonly events: AuthEventRepository,
  ) {}

  /**
   * The full evaluation, per §13's 9-step list (minus workflow/SoD
   * constraints — see class doc): active-status → project-aware role
   * resolution → grant check, with a safe reason code on denial. Does
   * *not* itself emit an audit event — that only happens at a real
   * enforcement point (`PermissionGuard`), not every informational check
   * (e.g. building a `/me/capabilities` response would otherwise flood
   * `auth_events` with one row per permission probed).
   */
  async evaluate(
    userId: string,
    moduleKey: string,
    action: string,
    projectId?: string,
  ): Promise<AuthorizationDecision> {
    const user = await this.users.findById(userId);
    if (!user) {
      return { allowed: false, reasonCode: "user_not_found" };
    }
    if (user.accountStatus !== "active") {
      return { allowed: false, reasonCode: "user_disabled" };
    }

    const module = await this.modules.findByKey(moduleKey);
    if (!module) {
      return { allowed: false, reasonCode: "unknown_module" };
    }

    const roleIds = await this.userRoles.findRoleIdsForUser(userId, projectId);
    if (roleIds.length === 0) {
      return { allowed: false, reasonCode: "no_roles" };
    }

    const granted = await this.rolePermissions.hasGrant(roleIds, module.id, action, projectId);
    return granted
      ? { allowed: true, reasonCode: null }
      : { allowed: false, reasonCode: "no_grant" };
  }

  async can(
    userId: string,
    moduleKey: string,
    action: string,
    projectId?: string,
  ): Promise<boolean> {
    return (await this.evaluate(userId, moduleKey, action, projectId)).allowed;
  }

  /** `06_Roles_and_Permissions.md §5` — a user may view a record while being denied its confidential fields. */
  async canViewConfidential(
    userId: string,
    moduleKey: string,
    projectId?: string,
  ): Promise<boolean> {
    return this.can(userId, moduleKey, CONFIDENTIAL_VIEW_ACTION, projectId);
  }

  async canEditConfidential(
    userId: string,
    moduleKey: string,
    projectId?: string,
  ): Promise<boolean> {
    return this.can(userId, moduleKey, CONFIDENTIAL_EDIT_ACTION, projectId);
  }

  /**
   * The current user's effective capabilities, grouped by module key —
   * `{ moduleKey: [action, ...] }` — the input `/me/capabilities` (task
   * package §15/§20) returns. One query for roles, one for grants (via
   * `listGrantsForRoles`), one for the module key lookup — never N+1 over
   * every module×action pair, per §28. Returns `{}` for a disabled or
   * unknown user rather than throwing — the frontend capability model is
   * informational, not itself an enforcement point (every real action
   * still goes through `evaluate()`/`PermissionGuard`).
   */
  async getEffectiveCapabilities(
    userId: string,
    projectId?: string,
  ): Promise<Readonly<Record<string, readonly string[]>>> {
    const user = await this.users.findById(userId);
    if (!user || user.accountStatus !== "active") {
      return {};
    }

    const roleIds = await this.userRoles.findRoleIdsForUser(userId, projectId);
    if (roleIds.length === 0) {
      return {};
    }

    const [grants, modules] = await Promise.all([
      this.rolePermissions.listGrantsForRoles(roleIds, projectId),
      this.modules.listAll(),
    ]);
    const moduleKeyById = new Map(modules.map((module) => [module.id, module.key]));

    const capabilities: Record<string, string[]> = {};
    for (const grant of grants) {
      const moduleKey = moduleKeyById.get(grant.moduleId);
      if (!moduleKey) {
        continue;
      }
      const actions = (capabilities[moduleKey] ??= []);
      if (!actions.includes(grant.action)) {
        actions.push(grant.action);
      }
    }
    return capabilities;
  }

  /**
   * Records a `privileged_access_denied` event — called only from a real
   * enforcement point (`PermissionGuard`, or a dynamic per-request check via
   * `assertAllowed()`/its own pre-existing hand-rolled callers) that actually
   * blocked a request, not from informational `can()`/`evaluate()` calls.
   * Closes the "no persisted audit trail for denied permission checks" gap
   * flagged in docs/security/threat-model-authorization-rbac.md's
   * accepted-gaps list.
   */
  async recordAccessDenied(
    userId: string,
    moduleKey: string,
    action: string,
    reasonCode: DenialReasonCode,
  ): Promise<void> {
    await this.events.record({
      eventType: "privileged_access_denied",
      userId,
      success: false,
      reason: `module:${moduleKey} action:${action} reason:${reasonCode}`,
    });
  }

  /**
   * Centralizes the `evaluate()` → `recordAccessDenied()` → throw pattern for
   * a dynamic, per-request permission check made outside `PermissionGuard`
   * — e.g. a status-transition route whose real required action varies by
   * payload (submit/review/approve), not by static route, so a single
   * `@RequirePermission` decorator can't express it. `PermissionGuard` and
   * `ProjectApproversService.assign()` each still hand-roll this same
   * sequence directly (pre-existing, unchanged); new dynamic-check call
   * sites should prefer this helper instead of hand-rolling a fourth copy
   * (code-review finding, `module-service-library`).
   */
  async assertAllowed(userId: string, moduleKey: string, action: string): Promise<void> {
    const decision = await this.evaluate(userId, moduleKey, action);
    if (!decision.allowed) {
      await this.recordAccessDenied(userId, moduleKey, action, decision.reasonCode!);
      throw new ForbiddenException(`Missing permission: ${moduleKey}:${action}`);
    }
  }
}
