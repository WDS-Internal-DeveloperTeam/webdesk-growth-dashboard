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
 *
 * Extended by migrations 00034/00035 (Phase 1F, `docs/task-packages/phase-1f-application-shell.md`)
 * with the full field set the application shell's registry-driven navigation needs — this is the
 * ONE canonical registry; `dashboard-web` does not maintain a competing copy.
 */
export interface ModuleRegistryEntity extends BaseEntity {
  readonly key: string;
  readonly name: string;
  readonly permissionGroupId: string;
  readonly displayName: string | null;
  readonly description: string | null;
  readonly navigationGroup: string;
  readonly navigationOrder: number;
  readonly route: string;
  readonly iconReference: string | null;
  readonly v1InclusionStatus: "included" | "deferred" | "future";
  readonly implementationStatus:
    | "not_started"
    | "foundation_only"
    | "in_development"
    | "ready_for_review"
    | "approved"
    | "available"
    | "deferred"
    | "blocked"
    | "deprecated";
  readonly viewPermissionAction: string;
  readonly actionPermissions: readonly string[] | null;
  readonly featureStatus: string | null;
  readonly documentationReference: string | null;
  readonly helpDocumentReference: string | null;
  readonly owner: string | null;
  readonly dependencies: readonly string[] | null;
  readonly confidentialityLevel: string | null;
  readonly badgeSupport: boolean;
  readonly visibilityRules: Readonly<Record<string, unknown>> | null;
  readonly deprecationReference: string | null;
  readonly registryVersion: number;
  readonly lastReviewedAt: string | null;
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
