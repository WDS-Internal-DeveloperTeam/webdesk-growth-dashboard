import { Inject, Injectable } from "@nestjs/common";
import type { AuthLockoutStateRepository } from "@webdesk/database";
import { AUTH_ENV, AUTH_LOCKOUT_STATE_REPOSITORY } from "../config/auth.constants.js";
import type { AuthEnv } from "../config/auth-env.js";

export interface LockoutCheckResult {
  readonly locked: boolean;
  readonly lockedUntil: Date | null;
}

/**
 * The "is this locked / has the window expired / does this trip a
 * lockout" decision layer on top of `packages/database`'s deliberately
 * mechanical `AuthLockoutStateRepository` (base skill
 * `security/01-owasp-api.md` baseline, applied per knowledge/05). Used for
 * every credentialed step in the emergency-local flow — password and TOTP
 * are separate `scope`s, so a TOTP-guessing spree against a correctly-
 * entered password doesn't share a counter with password-guessing.
 */
@Injectable()
export class RateLimitService {
  constructor(
    @Inject(AUTH_LOCKOUT_STATE_REPOSITORY) private readonly lockoutRepo: AuthLockoutStateRepository,
    @Inject(AUTH_ENV) private readonly env: AuthEnv,
  ) {}

  async isLocked(scope: string, identifier: string, now = new Date()): Promise<LockoutCheckResult> {
    const row = await this.lockoutRepo.get(scope, identifier);
    if (!row?.lockedUntil) {
      return { locked: false, lockedUntil: null };
    }
    const lockedUntil = new Date(row.lockedUntil);
    return lockedUntil > now ? { locked: true, lockedUntil } : { locked: false, lockedUntil: null };
  }

  /** Records a failed attempt against `scope`+`identifier`; returns whether this failure just tripped a lockout. */
  async recordFailure(
    scope: string,
    identifier: string,
    now = new Date(),
  ): Promise<LockoutCheckResult> {
    const existing = await this.lockoutRepo.get(scope, identifier);
    const windowExpired =
      existing?.firstFailedAt !== null &&
      existing?.firstFailedAt !== undefined &&
      now.getTime() - new Date(existing.firstFailedAt).getTime() >
        this.env.AUTH_LOCKOUT_WINDOW_SECONDS * 1000;

    if (windowExpired) {
      await this.lockoutRepo.reset(scope, identifier);
    }

    const updated = await this.lockoutRepo.recordFailure(scope, identifier, now);
    if (updated.failedCount >= this.env.AUTH_LOCKOUT_MAX_ATTEMPTS) {
      const lockedUntil = new Date(now.getTime() + this.env.AUTH_LOCKOUT_DURATION_SECONDS * 1000);
      await this.lockoutRepo.lock(scope, identifier, lockedUntil);
      return { locked: true, lockedUntil };
    }
    return { locked: false, lockedUntil: null };
  }

  async recordSuccess(scope: string, identifier: string): Promise<void> {
    await this.lockoutRepo.reset(scope, identifier);
  }
}
