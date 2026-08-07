import type { Model } from "sequelize";
import { getAuthModels } from "./models.js";
import type { AuthMethod, SessionEntity, SessionRevocationReason } from "./entities.js";

function toEntity(instance: Model): SessionEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    userId: json.userId as string,
    tokenHash: json.tokenHash as string,
    authMethod: json.authMethod as AuthMethod,
    requiresMfa: json.requiresMfa as boolean,
    mfaVerifiedAt: json.mfaVerifiedAt instanceof Date ? json.mfaVerifiedAt.toISOString() : null,
    lastActivityAt: json.lastActivityAt instanceof Date ? json.lastActivityAt.toISOString() : null,
    expiresAt: (json.expiresAt as Date).toISOString(),
    revokedAt: json.revokedAt instanceof Date ? json.revokedAt.toISOString() : null,
    revokedReason: (json.revokedReason as SessionRevocationReason | null) ?? null,
    ipHash: (json.ipHash as string | null) ?? null,
    userAgent: (json.userAgent as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

export class SessionRepository {
  private readonly model = getAuthModels().Session;

  async create(input: {
    userId: string;
    tokenHash: string;
    authMethod: AuthMethod;
    requiresMfa: boolean;
    expiresAt: Date;
    ipHash?: string | null;
    userAgent?: string | null;
  }): Promise<SessionEntity> {
    const instance = await this.model.create(input);
    return toEntity(instance);
  }

  async findByTokenHash(tokenHash: string): Promise<SessionEntity | null> {
    const instance = await this.model.findOne({ where: { tokenHash } });
    return instance ? toEntity(instance) : null;
  }

  async findById(id: string): Promise<SessionEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntity(instance) : null;
  }

  /** Completes the emergency-admin two-step flow: extends the pending session to the full window and marks MFA verified. */
  async elevateAfterMfa(id: string, expiresAt: Date, mfaVerifiedAt: Date): Promise<void> {
    await this.model.update({ mfaVerifiedAt, expiresAt, requiresMfa: false }, { where: { id } });
  }

  async touchActivity(id: string, at: Date): Promise<void> {
    await this.model.update({ lastActivityAt: at }, { where: { id } });
  }

  async revoke(id: string, reason: SessionRevocationReason, at: Date): Promise<void> {
    await this.model.update({ revokedAt: at, revokedReason: reason }, { where: { id } });
  }

  /** Revokes every active session for a user — used on role change / account suspension (knowledge/05). */
  async revokeAllForUser(
    userId: string,
    reason: SessionRevocationReason,
    at: Date,
  ): Promise<number> {
    const [count] = await this.model.update(
      { revokedAt: at, revokedReason: reason },
      { where: { userId, revokedAt: null } },
    );
    return count;
  }
}
