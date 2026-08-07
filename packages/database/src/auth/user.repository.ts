import type { Model } from "sequelize";
import { getAuthModels } from "./models.js";
import type { UserEntity } from "./entities.js";

function toEntity(instance: Model): UserEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    email: json.email as string,
    displayName: json.displayName as string,
    accountStatus: json.accountStatus as UserEntity["accountStatus"],
    lastLoginAt: json.lastLoginAt instanceof Date ? json.lastLoginAt.toISOString() : null,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

/**
 * Pre-provisioned-only lookup (resolved this session,
 * docs/task-packages/phase-1c-authentication-sessions.md §2): this
 * repository never creates a user as a side effect of a login attempt —
 * `findByEmail` returning `null` means the caller rejects the login, it
 * never falls through to `create`.
 */
export class UserRepository {
  private readonly model = getAuthModels().User;

  async findById(id: string): Promise<UserEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntity(instance) : null;
  }

  /** `email` must already be lowercased by the caller — this repository does not normalize it. */
  async findByEmail(email: string): Promise<UserEntity | null> {
    const instance = await this.model.findOne({ where: { email } });
    return instance ? toEntity(instance) : null;
  }

  /** Provisioning is an out-of-band, administrator-driven action (Task 8, separate authorization) — exposed here only for the CLI seed script and tests. */
  async create(input: {
    email: string;
    displayName: string;
    accountStatus?: "active" | "disabled";
  }): Promise<UserEntity> {
    const instance = await this.model.create({
      email: input.email,
      displayName: input.displayName,
      accountStatus: input.accountStatus ?? "active",
    });
    return toEntity(instance);
  }

  async recordSuccessfulLogin(id: string, loginAt: Date): Promise<void> {
    await this.model.update({ lastLoginAt: loginAt }, { where: { id } });
  }
}
