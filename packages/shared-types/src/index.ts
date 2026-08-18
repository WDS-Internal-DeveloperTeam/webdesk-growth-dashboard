/**
 * Application-neutral shared types. Phase 1A ships only cross-cutting
 * foundation shapes (results, pagination, API envelopes, health checks) —
 * no business-module types (Project, CaseStudy, etc.) until their owning
 * module is actually authorized and implemented.
 */

export type Result<T, E = Error> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Base shape every persisted entity carries — id + audit timestamps. Not a Sequelize model; see packages/database. */
export interface BaseEntity {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PaginationParams {
  readonly page: number;
  readonly pageSize: number;
}

export interface PaginatedResult<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

/** Standard API response envelope used by dashboard-api. */
export interface ApiSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly correlationId: string;
}

/** A single field-level validation failure — mirrors `ZodValidationPipe`'s `issues` shape. */
export interface ApiErrorIssue {
  readonly path: string;
  readonly message: string;
}

export interface ApiErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    /** Present only for a Zod validation failure — see `ZodValidationPipe`/`AllExceptionsFilter`. */
    readonly issues?: readonly ApiErrorIssue[];
  };
  readonly correlationId: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export type HealthStatus = "ok" | "degraded" | "down";

/** Safe build/release metadata (Phase 1F brief §24) — see `@webdesk/configuration`'s `getBuildMetadata`. */
export interface HealthCheckBuildInfo {
  readonly version: string;
  readonly commitSha: string;
  readonly commitShaShort: string;
  readonly environment: string;
  readonly deploymentId: string;
  readonly processStartedAt: string;
}

export interface HealthCheckResult {
  readonly status: HealthStatus;
  readonly service: string;
  readonly timestamp: string;
  readonly checks?: Readonly<Record<string, HealthStatus>>;
  readonly build?: HealthCheckBuildInfo;
}

/**
 * Phase 1C — authentication and session shapes (ADR-0008, ADR-0009,
 * docs/contracts/google-workspace-auth-contract.md). Identity only: no
 * role/permission fields here — RBAC (ADR-0010) is a separate, later
 * authorization and layers on top of `AuthenticatedUser.id`, not this type.
 */
export type AuthMethod = "google_sso" | "emergency_local";

export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly authMethod: AuthMethod;
}

/** What `GET /auth/session` returns — never includes the raw session token itself. */
export interface SessionInfo {
  readonly user: AuthenticatedUser;
  readonly expiresAt: string;
  /** True once the emergency-local two-step (password, then TOTP) has fully completed. Always true for `google_sso`. */
  readonly mfaVerified: boolean;
}

/**
 * Every event knowledge/05-google-workspace-sso-and-local-admin.md's "Login
 * audit events" section requires. Narrow and login-scoped — not the
 * general-purpose ADR-0017 audit-log subsystem (Task 7, separate
 * authorization); this exists so Task 7 can later adopt/extend it, not so it
 * competes with it.
 */
export type AuthEventType =
  | "sso_login_succeeded"
  | "sso_login_rejected"
  | "emergency_login_succeeded"
  | "emergency_login_failed"
  | "emergency_totp_failed"
  | "account_lockout_triggered"
  | "recovery_request_created"
  | "recovery_request_approved"
  | "recovery_request_denied"
  | "session_revoked"
  | "role_assigned"
  | "role_revoked"
  | "permission_granted"
  | "permission_revoked"
  | "privileged_access_denied"
  | "confidential_field_accessed"
  | "separation_of_duties_denied"
  | "super_admin_bootstrap"
  | "authorization_configuration_changed";

/** Reasons a session can end, per knowledge/05's "Logout / session revocation" requirement. */
export type SessionRevocationReason =
  "user-initiated" | "role-change" | "admin-forced" | "security-incident" | "expired";

/**
 * Phase 1D — RBAC (ADR-0010). API-facing shape for a role — deliberately
 * omits internal timestamps a client has no use for, same reasoning as
 * `AuthenticatedUser` never including a raw session token.
 */
export interface RoleSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
}

/**
 * Phase 1D (expanded) — the 21-row permission-granting module ("permission
 * group") from `06_Roles_and_Permissions.md §3` — see
 * docs/implementation/phase-1d-permission-catalog.md §3 for why this is a
 * separate concept from `ModuleRegistrySummary` below.
 */
export interface ModuleSummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
}

/**
 * The 43 real dashboard feature modules from `02_Version_1_Module_Inclusion_Matrix.md`, each
 * mapped to the permission group that gates it. Extended by Phase 1F
 * (`docs/task-packages/phase-1f-application-shell.md`) with the full field set the application
 * shell's registry-driven navigation reads — the canonical module registry, not a duplicate.
 */
export interface ModuleRegistrySummary {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly permissionGroupKey: string;
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
  readonly deprecationReference: string | null;
  /** Whether the current caller may view this module, per their effective capabilities — set only
   *  by capability-aware endpoints (e.g. navigation); absent/undefined from unfiltered catalog reads. */
  readonly canView?: boolean;
}

/**
 * The 10 approved top-level navigation labels (`07_Low_Fidelity_Wireframes.md` §1). The single
 * source both `dashboard-web`'s navigation rendering and `validate-module-registry.ts` read —
 * changing a module's nav group without updating this list (or vice versa) is exactly the drift
 * the Phase 1F registry validation catches.
 */
export const APPROVED_NAVIGATION_GROUPS: readonly string[] = [
  "home",
  "projects",
  "pages",
  "libraries",
  "workflow",
  "scans",
  "technical",
  "releases",
  "help",
  "settings",
];

/**
 * The subset of `ProjectEntity` (`packages/database/src/projects/entities.ts`) the shell's
 * Project Switcher needs — deliberately not the full backend entity (description, confidentiality,
 * retention category, etc. stay server-side/module-page concerns, not header-chrome concerns).
 * `module-projects-foundation` made `GET /projects` real for the first time
 * (`docs/task-packages/module-projects-foundation.md` D7); this is that module's first
 * cross-boundary type, following this file's own header rule ("no business-module types until
 * their owning module is actually authorized and implemented" — now true for Projects).
 */
export interface ProjectSummary {
  readonly id: string;
  readonly publicId: string;
  readonly name: string;
  readonly status: "active" | "paused" | "archived";
}

/**
 * The read-only identity-lookup capability's own response shape (`GET /users`) — the narrowest
 * projection of `UserEntity` (`packages/database/src/auth/entities.ts`) a picker UI needs to let
 * someone search for and select an existing user. Deliberately excludes `accountStatus` (the
 * endpoint that returns this already filters to active-only) and `lastLoginAt`/timestamps — no
 * picker consumer needs them, and this file's own precedent (`Project` vs `ProjectSummary`) is to
 * project only what a given UI surface actually reads, not the full backend entity. This is the
 * first real user-lookup capability in this app — `Project.ownerUserId` and `ProjectTeamEntry`
 * previously had no name-resolution endpoint to call; this is that endpoint's frontend type.
 */
export interface UserSummary {
  readonly id: string;
  readonly displayName: string;
  readonly email: string;
}

/**
 * The Projects list page's own row shape — a second, wider projection of `ProjectEntity` alongside
 * `ProjectSummary` above, not a replacement for it (the switcher stays on the narrower type it
 * already validated against). Deliberately still not the full backend entity: `activePhaseId` and
 * `ownerUserId` are bare foreign keys, and the list page still doesn't resolve them to a display
 * name — a name-resolution endpoint now exists (`GET /users/:userId`, see `UserSummary` above),
 * but wiring it into this page's per-row rendering (N lookups for N rows) is separate, not-yet-done
 * scope, not a capability gap anymore. `retentionCategory`/`createdBy`/`updatedBy` are operational
 * metadata, not list-page content.
 */
export interface Project {
  readonly id: string;
  readonly publicId: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: "active" | "paused" | "archived";
  readonly confidentiality: "public" | "internal" | "confidential" | "restricted";
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * The Projects detail page's own shape — unlike `Project` above, this legitimately carries
 * `activePhaseId`/`ownerUserId` again: the detail page also fetches the project's own roadmap
 * items in the same request pass, so `activePhaseId` can be resolved to a real name by
 * cross-referencing that array (no fabrication, no raw UUID shown). `ownerUserId`'s raw value is
 * used only to render a boolean "assigned"/"not assigned" state — the create/edit form (not this
 * type) is what actually resolves it to a display identity, via the same `GET /users/:userId`
 * endpoint `UserSummary` above documents; wiring an owner display into the read-only detail view
 * itself remains separate, not-yet-done scope. `retentionCategory`/`createdBy`/`updatedBy` remain
 * operational metadata, out of scope for either shape.
 */
export interface ProjectDetail extends Project {
  readonly activePhaseId: string | null;
  readonly ownerUserId: string | null;
}

/** A project's roadmap "phase" (`RoadmapItemEntity`) — `createdBy`/`updatedBy` omitted as operational metadata, matching `Project`'s own precedent. */
export interface RoadmapItem {
  readonly id: string;
  readonly name: string;
  readonly sequence: number;
  readonly status: "not_started" | "active" | "complete" | "skipped";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectObjective {
  readonly id: string;
  readonly description: string;
  readonly status: "open" | "complete";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectEnvironment {
  readonly id: string;
  readonly name: string;
  readonly url: string | null;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectRepository {
  readonly id: string;
  readonly repoOwner: string;
  readonly repoName: string;
  readonly defaultBranch: string;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * The project team roster's own entry (`ProjectUserEntity`, `packages/database/src/projects/entities.ts`).
 * `userId` is resolved to a display identity via `GET /users/:userId` — one lookup per roster
 * entry, the same N-lookups approach `ProjectDetail.ownerUserId`'s resolution already established
 * for the edit form, since no batch team-resolve endpoint exists (team rosters are small). `id` is
 * this entry's own row id, needed (not `userId`) to call `DELETE /projects/:projectId/team/:id`.
 * `addedBy` (who added this member) is operational metadata, omitted same as `Project`'s own
 * `createdBy`/`updatedBy`.
 */
export interface ProjectTeamEntry {
  readonly id: string;
  readonly userId: string;
  readonly addedAt: string;
}
