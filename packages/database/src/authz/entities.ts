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
}
