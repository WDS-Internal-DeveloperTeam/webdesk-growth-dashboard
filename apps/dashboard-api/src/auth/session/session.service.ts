import { Inject, Injectable } from "@nestjs/common";
import type {
  AuthEventRepository,
  AuthMethod,
  SessionEntity,
  SessionRepository,
  SessionRevocationReason,
} from "@webdesk/database";
import { AUTH_ENV, AUTH_EVENT_REPOSITORY, SESSION_REPOSITORY } from "../config/auth.constants.js";
import type { AuthEnv } from "../config/auth-env.js";
import { generateSessionToken, hashSessionToken } from "../crypto/session-token.js";

export interface IssuedSession {
  readonly session: SessionEntity;
  readonly rawToken: string;
}

/**
 * Session issuance/validation/revocation (knowledge/05 "Session, downstream
 * of SSO", docs/task-packages/phase-1c-authentication-sessions.md §4). The
 * emergency-admin two-step flow is modeled as one session row that starts
 * `requiresMfa: true` with a short pending expiry, then gets elevated in
 * place once TOTP succeeds — see `elevateAfterMfa`.
 */
@Injectable()
export class SessionService {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(AUTH_EVENT_REPOSITORY) private readonly events: AuthEventRepository,
    @Inject(AUTH_ENV) private readonly env: AuthEnv,
  ) {}

  async issue(input: {
    userId: string;
    authMethod: AuthMethod;
    requiresMfa: boolean;
    ipHash?: string | null;
    userAgent?: string | null;
    now?: Date;
  }): Promise<IssuedSession> {
    const now = input.now ?? new Date();
    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = input.requiresMfa
      ? new Date(now.getTime() + this.env.SESSION_PENDING_MFA_MAX_AGE_SECONDS * 1000)
      : new Date(now.getTime() + this.env.SESSION_MAX_AGE_SECONDS * 1000);

    const session = await this.sessions.create({
      userId: input.userId,
      tokenHash,
      authMethod: input.authMethod,
      requiresMfa: input.requiresMfa,
      expiresAt,
      ipHash: input.ipHash ?? null,
      userAgent: input.userAgent ?? null,
    });
    return { session, rawToken };
  }

  /** Completes the emergency-admin two-step flow: extends the session to the full window and marks MFA verified. Returns the updated row — the caller's in-memory copy of the pending session is stale the moment this resolves. */
  async elevateAfterMfa(sessionId: string, now = new Date()): Promise<SessionEntity> {
    const expiresAt = new Date(now.getTime() + this.env.SESSION_MAX_AGE_SECONDS * 1000);
    await this.sessions.elevateAfterMfa(sessionId, expiresAt, now);
    const updated = await this.sessions.findById(sessionId);
    if (!updated) {
      throw new Error(`Session not found after elevation: ${sessionId}`);
    }
    return updated;
  }

  /** A valid, fully-authenticated (not pending-MFA) session for the given raw token, or `null`. Touches last-activity on success. */
  async validate(rawToken: string, now = new Date()): Promise<SessionEntity | null> {
    const session = await this.sessions.findByTokenHash(hashSessionToken(rawToken));
    if (!session || session.revokedAt || session.requiresMfa) {
      return null;
    }
    if (new Date(session.expiresAt) <= now) {
      return null;
    }
    await this.sessions.touchActivity(session.id, now);
    return session;
  }

  /** A pending (not-yet-MFA-verified) session for the given raw token — used only by the TOTP-verification step. */
  async findPending(rawToken: string, now = new Date()): Promise<SessionEntity | null> {
    const session = await this.sessions.findByTokenHash(hashSessionToken(rawToken));
    if (!session || session.revokedAt || !session.requiresMfa) {
      return null;
    }
    if (new Date(session.expiresAt) <= now) {
      return null;
    }
    return session;
  }

  /** Revokes immediately and records the required "Logout / session revocation, and the reason" audit event (knowledge/05). */
  async revoke(
    sessionId: string,
    reason: SessionRevocationReason,
    now = new Date(),
  ): Promise<void> {
    const session = await this.sessions.findById(sessionId);
    await this.sessions.revoke(sessionId, reason, now);
    await this.events.record({
      eventType: "session_revoked",
      userId: session?.userId ?? null,
      sessionId,
      authMethod: session?.authMethod ?? null,
      success: true,
      reason,
    });
  }

  /** Revokes every active session for a user — role change / account suspension (knowledge/05). Records one event per revoked session, same as a single `revoke()` call would. */
  async revokeAllForUser(
    userId: string,
    reason: SessionRevocationReason,
    now = new Date(),
  ): Promise<number> {
    const count = await this.sessions.revokeAllForUser(userId, reason, now);
    if (count > 0) {
      await this.events.record({
        eventType: "session_revoked",
        userId,
        sessionId: null,
        authMethod: null,
        success: true,
        reason: `${reason} (${count} session(s))`,
      });
    }
    return count;
  }
}
