import type { BaseEntity } from "@webdesk/shared-types";

/**
 * Phase 1C persistence-layer entity shapes (packages/database internal —
 * distinct from `@webdesk/shared-types`'s `AuthenticatedUser`/`SessionInfo`,
 * which are the API-facing DTOs `dashboard-api` returns to clients). See
 * docs/task-packages/phase-1c-authentication-sessions.md §4.
 */

export interface UserEntity extends BaseEntity {
  readonly email: string;
  readonly displayName: string;
  readonly accountStatus: "active" | "disabled";
  readonly lastLoginAt: string | null;
}

export interface ExternalAuthIdentityEntity extends BaseEntity {
  readonly userId: string;
  readonly provider: string;
  readonly providerSubjectId: string;
  readonly workspaceDomain: string;
}

export interface EmergencyAdminCredentialEntity extends BaseEntity {
  readonly userId: string;
  readonly passwordHash: string;
  /** Packed `${ivHex}:${authTagHex}:${ciphertextHex}` — see apps/dashboard-api/src/auth/crypto. */
  readonly totpSecretEncrypted: string;
  readonly totpEnrolledAt: string | null;
  readonly status: "active" | "disabled";
}

export type AuthMethod = "google_sso" | "emergency_local";
export type SessionRevocationReason =
  "user-initiated" | "role-change" | "admin-forced" | "security-incident" | "expired";

export interface SessionEntity extends BaseEntity {
  readonly userId: string;
  /** SHA-256 hex of the raw opaque token — the raw token itself is never persisted. */
  readonly tokenHash: string;
  readonly authMethod: AuthMethod;
  readonly requiresMfa: boolean;
  readonly mfaVerifiedAt: string | null;
  readonly lastActivityAt: string | null;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly revokedReason: SessionRevocationReason | null;
  readonly ipHash: string | null;
  readonly userAgent: string | null;
}

export interface AuthLockoutStateEntity extends BaseEntity {
  readonly scope: string;
  readonly identifier: string;
  readonly failedCount: number;
  readonly firstFailedAt: string | null;
  readonly lockedUntil: string | null;
  readonly lastAttemptAt: string;
}

export type RecoveryRequestStatus = "pending" | "approved" | "rejected";

export interface RecoveryRequestEntity extends BaseEntity {
  readonly targetUserId: string;
  readonly requestedByUserId: string | null;
  readonly reason: string;
  readonly status: RecoveryRequestStatus;
  readonly decidedByUserId: string | null;
  readonly decidedAt: string | null;
  readonly decisionNote: string | null;
}

/** Append-only — no `updatedAt`, so this deliberately does not extend `BaseEntity`. */
export interface AuthEventEntity {
  readonly id: string;
  readonly eventType: string;
  readonly userId: string | null;
  readonly sessionId: string | null;
  readonly authMethod: string | null;
  readonly success: boolean;
  readonly reason: string | null;
  readonly ipHash: string | null;
  readonly userAgent: string | null;
  readonly createdAt: string;
}
