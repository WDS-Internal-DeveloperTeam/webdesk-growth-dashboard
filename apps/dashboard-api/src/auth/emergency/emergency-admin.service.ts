import { Inject, Injectable } from "@nestjs/common";
import type {
  AuthEventRepository,
  EmergencyAdminCredentialRepository,
  SessionEntity,
  UserRepository,
} from "@webdesk/database";
import {
  AUTH_ENV,
  AUTH_EVENT_REPOSITORY,
  EMERGENCY_ADMIN_CREDENTIAL_REPOSITORY,
  EMERGENCY_ADMIN_LOGIN_NOTIFIER,
  USER_REPOSITORY,
} from "../config/auth.constants.js";
import type { AuthEnv } from "../config/auth-env.js";
import { decryptTotpSecret } from "../crypto/totp-encryption.js";
import { hashPassword, verifyPassword } from "../crypto/password.js";
import { verifyTotpToken } from "../crypto/totp.js";
// Real (value) imports, not `import type` — NestJS's constructor injection
// relies on emitDecoratorMetadata, which needs the actual class reference
// at runtime (see google-auth.service.ts's identical note for SessionService).
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RateLimitService } from "../common/rate-limit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SessionService } from "../session/session.service.js";
import type { EmergencyAdminLoginNotifier } from "./emergency-admin-login-notifier.js";

const PASSWORD_STEP_SCOPE = "emergency_login";
const TOTP_STEP_SCOPE = "emergency_totp";

/** A precomputed argon2id hash of a fixed, never-real password — verified against on every login attempt for an unknown/inactive account so the response takes roughly the same time as a real password check (mitigates timing-based account enumeration). */
let cachedDummyHash: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  cachedDummyHash ??= hashPassword("dummy-password-never-a-real-credential");
  return cachedDummyHash;
}

export type EmergencyLoginResult =
  | { readonly ok: true; readonly pendingSessionId: string; readonly rawToken: string }
  | { readonly ok: false };

export type EmergencyTotpResult =
  | { readonly ok: true; readonly userId: string; readonly session: SessionEntity }
  | { readonly ok: false };

interface LoginContext {
  readonly ipHash: string | null;
  readonly userAgent: string | null;
  readonly now?: Date;
}

/**
 * ADR-0009 — restricted local emergency-administrator authentication, two
 * steps: `login` (password) issues a short-lived pending session;
 * `verifyTotp` elevates it to a full session. Every failure path returns
 * the same `{ ok: false }` shape regardless of *why* — unknown email, wrong
 * password, disabled credential, and locked-out identifier are all
 * indistinguishable to the caller (no user enumeration), differing only in
 * the `reason` recorded on the internal audit event.
 */
@Injectable()
export class EmergencyAdminService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(EMERGENCY_ADMIN_CREDENTIAL_REPOSITORY)
    private readonly credentials: EmergencyAdminCredentialRepository,
    @Inject(AUTH_EVENT_REPOSITORY) private readonly events: AuthEventRepository,
    @Inject(AUTH_ENV) private readonly env: AuthEnv,
    @Inject(EMERGENCY_ADMIN_LOGIN_NOTIFIER) private readonly notifier: EmergencyAdminLoginNotifier,
    private readonly rateLimit: RateLimitService,
    private readonly sessionService: SessionService,
  ) {}

  async login(
    email: string,
    password: string,
    context: LoginContext,
  ): Promise<EmergencyLoginResult> {
    const now = context.now ?? new Date();
    const identifier = email.toLowerCase();

    const lockCheck = await this.rateLimit.isLocked(PASSWORD_STEP_SCOPE, identifier, now);
    if (lockCheck.locked) {
      await this.recordFailure(null, "locked_out");
      return { ok: false };
    }

    const user = await this.users.findByEmail(identifier);
    const credential = user ? await this.credentials.findByUserId(user.id) : null;

    let passwordOk: boolean;
    if (credential && credential.status === "active") {
      passwordOk = await verifyPassword(credential.passwordHash, password);
    } else {
      await verifyPassword(await getDummyHash(), password);
      passwordOk = false;
    }

    if (!user || !credential || credential.status !== "active" || !passwordOk) {
      const failureResult = await this.rateLimit.recordFailure(
        PASSWORD_STEP_SCOPE,
        identifier,
        now,
      );
      await this.recordFailure(user?.id ?? null, "invalid_credentials");
      if (failureResult.locked) {
        await this.recordLockout(user?.id ?? null, PASSWORD_STEP_SCOPE);
      }
      return { ok: false };
    }

    await this.rateLimit.recordSuccess(PASSWORD_STEP_SCOPE, identifier);
    const issued = await this.sessionService.issue({
      userId: user.id,
      authMethod: "emergency_local",
      requiresMfa: true,
      ipHash: context.ipHash,
      userAgent: context.userAgent,
      now,
    });

    return { ok: true, pendingSessionId: issued.session.id, rawToken: issued.rawToken };
  }

  async verifyTotp(
    rawPendingToken: string,
    code: string,
    context: LoginContext,
  ): Promise<EmergencyTotpResult> {
    const now = context.now ?? new Date();
    const pending = await this.sessionService.findPending(rawPendingToken, now);
    if (!pending) {
      return { ok: false };
    }

    const lockCheck = await this.rateLimit.isLocked(TOTP_STEP_SCOPE, pending.id, now);
    if (lockCheck.locked) {
      await this.recordFailure(pending.userId, "locked_out", pending.id);
      return { ok: false };
    }

    const credential = await this.credentials.findByUserId(pending.userId);
    const secret = credential
      ? decryptTotpSecret(credential.totpSecretEncrypted, this.env.TOTP_ENCRYPTION_KEY)
      : null;
    const valid = secret !== null && verifyTotpToken(code, secret);

    if (!credential || credential.status !== "active" || !valid) {
      const failureResult = await this.rateLimit.recordFailure(TOTP_STEP_SCOPE, pending.id, now);
      await this.events.record({
        eventType: "emergency_totp_failed",
        userId: pending.userId,
        sessionId: pending.id,
        authMethod: "emergency_local",
        success: false,
        reason: "invalid_totp",
      });
      if (failureResult.locked) {
        await this.recordLockout(pending.userId, TOTP_STEP_SCOPE, pending.id);
      }
      return { ok: false };
    }

    await this.rateLimit.recordSuccess(TOTP_STEP_SCOPE, pending.id);
    const elevated = await this.sessionService.elevateAfterMfa(pending.id, now);
    await this.users.recordSuccessfulLogin(pending.userId, now);
    await this.events.record({
      eventType: "emergency_login_succeeded",
      userId: pending.userId,
      sessionId: pending.id,
      authMethod: "emergency_local",
      success: true,
    });

    const user = await this.users.findById(pending.userId);
    if (user) {
      await this.notifier.notify({ userId: user.id, email: user.email, at: now });
    }

    return { ok: true, userId: pending.userId, session: elevated };
  }

  private async recordFailure(
    userId: string | null,
    reason: string,
    sessionId?: string,
  ): Promise<void> {
    await this.events.record({
      eventType: "emergency_login_failed",
      userId,
      sessionId: sessionId ?? null,
      authMethod: "emergency_local",
      success: false,
      reason,
    });
  }

  /** "Account lockout triggered" — required as its own distinct event, per knowledge/05's "Login audit events" list, not just implied by the failure event that caused it. */
  private async recordLockout(
    userId: string | null,
    scope: string,
    sessionId?: string,
  ): Promise<void> {
    await this.events.record({
      eventType: "account_lockout_triggered",
      userId,
      sessionId: sessionId ?? null,
      authMethod: "emergency_local",
      success: false,
      reason: scope,
    });
  }
}
