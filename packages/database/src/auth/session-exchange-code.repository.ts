import { Op, type Model } from "sequelize";
import { getAuthModels } from "./models.js";
import type { AuthMethod, SessionExchangeCodeEntity } from "./entities.js";

function toEntity(instance: Model): SessionExchangeCodeEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    userId: json.userId as string,
    authMethod: json.authMethod as AuthMethod,
    codeHash: json.codeHash as string,
    expiresAt: (json.expiresAt as Date).toISOString(),
    redeemedAt: json.redeemedAt instanceof Date ? json.redeemedAt.toISOString() : null,
    ipHash: (json.ipHash as string | null) ?? null,
    userAgent: (json.userAgent as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
  };
}

export class SessionExchangeCodeRepository {
  private readonly model = getAuthModels().SessionExchangeCode;

  async create(input: {
    userId: string;
    authMethod: AuthMethod;
    codeHash: string;
    expiresAt: Date;
    ipHash?: string | null;
    userAgent?: string | null;
  }): Promise<SessionExchangeCodeEntity> {
    const instance = await this.model.create(input);
    return toEntity(instance);
  }

  /**
   * Atomically redeems a code: only succeeds if it exists, is unexpired, and has never been
   * redeemed before. Uses a conditional `UPDATE ... WHERE redeemedAt IS NULL` (not a
   * read-then-write check) so two concurrent redeem attempts for the same code can never both
   * succeed — the loser's `affectedCount` comes back 0, mirroring
   * `IdempotencyKeyRepository.reserve()`'s own conditional-UPDATE discipline. `returning: true`
   * (Postgres) gets the post-update row back from the `UPDATE` itself, avoiding a second
   * round-trip to re-fetch it.
   */
  async redeem(codeHash: string, now: Date): Promise<SessionExchangeCodeEntity | null> {
    const [affectedCount, affectedRows] = await this.model.update(
      { redeemedAt: now },
      { where: { codeHash, redeemedAt: null, expiresAt: { [Op.gt]: now } }, returning: true },
    );
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntity(affectedRows[0]);
  }
}
