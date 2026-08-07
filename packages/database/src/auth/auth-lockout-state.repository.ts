import type { Model } from "sequelize";
import { getAuthModels } from "./models.js";
import type { AuthLockoutStateEntity } from "./entities.js";

function toEntity(instance: Model): AuthLockoutStateEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    scope: json.scope as string,
    identifier: json.identifier as string,
    failedCount: json.failedCount as number,
    firstFailedAt: json.firstFailedAt instanceof Date ? json.firstFailedAt.toISOString() : null,
    lockedUntil: json.lockedUntil instanceof Date ? json.lockedUntil.toISOString() : null,
    lastAttemptAt: (json.lastAttemptAt as Date).toISOString(),
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

/**
 * Deliberately mechanical — every "is this locked / has the window
 * expired / should this trip a lockout" decision is business logic that
 * lives in `apps/dashboard-api/src/auth/common/rate-limit.service.ts`, not
 * here (ADR-0002). This class only persists counters.
 */
export class AuthLockoutStateRepository {
  private readonly model = getAuthModels().AuthLockoutState;

  async get(scope: string, identifier: string): Promise<AuthLockoutStateEntity | null> {
    const instance = await this.model.findOne({ where: { scope, identifier } });
    return instance ? toEntity(instance) : null;
  }

  /** Atomic `failed_count + 1` via Sequelize's `increment()` (a server-side `UPDATE ... SET x = x + 1`) — safe under concurrent callers without an app-level lock. */
  async recordFailure(
    scope: string,
    identifier: string,
    now: Date,
  ): Promise<AuthLockoutStateEntity> {
    const [instance] = await this.model.findOrCreate({
      where: { scope, identifier },
      defaults: { scope, identifier, failedCount: 0, firstFailedAt: now, lastAttemptAt: now },
    });
    await instance.increment("failedCount");
    const patch: Record<string, unknown> = { lastAttemptAt: now };
    if (!instance.get("firstFailedAt")) {
      patch.firstFailedAt = now;
    }
    await instance.update(patch);
    await instance.reload();
    return toEntity(instance);
  }

  async lock(scope: string, identifier: string, lockedUntil: Date): Promise<void> {
    await this.model.update({ lockedUntil }, { where: { scope, identifier } });
  }

  /** Clears all state — called on a successful login, or once the caller has decided a stale window should restart. */
  async reset(scope: string, identifier: string): Promise<void> {
    await this.model.destroy({ where: { scope, identifier } });
  }
}
