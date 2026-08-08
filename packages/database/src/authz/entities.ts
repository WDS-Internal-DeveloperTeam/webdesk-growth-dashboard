import type { BaseEntity } from "@webdesk/shared-types";

/**
 * ADR-0010 RBAC persistence-layer entity shapes
 * (docs/task-packages/phase-1d-rbac-authorization.md §4).
 */

export interface RoleEntity extends BaseEntity {
  readonly key: string;
  readonly name: string;
}

export interface ModuleEntity extends BaseEntity {
  readonly key: string;
  readonly name: string;
}

export interface RolePermissionEntity extends BaseEntity {
  readonly roleId: string;
  readonly moduleId: string;
  readonly action: string;
  /** Schema-ready for the project-level axis; always `null` until Task 8's `projects` entity exists. */
  readonly projectId: string | null;
}

export interface UserRoleEntity extends BaseEntity {
  readonly userId: string;
  readonly roleId: string;
  /** Schema-ready for the project-level axis (migration 00016); `null` until Task 8's `projects` entity exists. */
  readonly projectId: string | null;
}

/**
 * The 43 real dashboard feature modules (`02_Version_1_Module_Inclusion_Matrix.md`) — a pure
 * lookup/resource registry, distinct from `ModuleEntity` (the 21-row permission-granting
 * granularity). See docs/implementation/phase-1d-permission-catalog.md §3.
 */
export interface ModuleRegistryEntity extends BaseEntity {
  readonly key: string;
  readonly name: string;
  readonly permissionGroupId: string;
}

/**
 * Generic prior-actor record for future separation-of-duties checks (migration 00017) —
 * append-only by construction (no repository update/delete method), same pattern as
 * `AuthEventEntity`.
 */
export interface AuthorizationActionEntity extends BaseEntity {
  readonly actorId: string;
  readonly actionType: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly occurredAt: string;
}
