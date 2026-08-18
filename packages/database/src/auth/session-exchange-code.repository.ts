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
  }): Promise<SessionExchangeCodeEntity> {
    const instance = await this.model.create(input);
    return toEntity(instance);
  }

  /**
   * Atomically redeems a code: only succeeds if it exists, is unexpired, and has never been
   * redeemed before. Uses a conditional `UPDATE ... WHERE redeemedAt IS NULL` (not a
   * read-then-write check) so two concurrent redeem attempts for the same code can never both
   * succeed — the loser's `affectedCount` comes back 0, mirroring
   * `IdempotencyKeyRepository.reserve()`'s own conditional-UPDATE discipline.
   */
  async redeem(codeHash: string, now: Date): Promise<SessionExchangeCodeEntity | null> {
    const [affectedCount] = await this.model.update(
      { redeemedAt: now },
      { where: { codeHash, redeemedAt: null, expiresAt: { [Op.gt]: now } } },
    );
    if (affectedCount === 0) {
      return null;
    }
    const instance = await this.model.findOne({ where: { codeHash } });
    return instance ? toEntity(instance) : null;
  }
}
