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

export interface ApiErrorResponse {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
  readonly correlationId: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export type HealthStatus = "ok" | "degraded" | "down";

export interface HealthCheckResult {
  readonly status: HealthStatus;
  readonly service: string;
  readonly timestamp: string;
  readonly checks?: Readonly<Record<string, HealthStatus>>;
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
  | "role_revoked";

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
