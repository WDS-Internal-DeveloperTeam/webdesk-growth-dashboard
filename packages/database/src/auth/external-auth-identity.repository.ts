import type { Model } from "sequelize";
import { getAuthModels } from "./models.js";
import type { ExternalAuthIdentityEntity } from "./entities.js";

function toEntity(instance: Model): ExternalAuthIdentityEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    userId: json.userId as string,
    provider: json.provider as string,
    providerSubjectId: json.providerSubjectId as string,
    workspaceDomain: json.workspaceDomain as string,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

/** Maps a Google `sub` claim to a `users` row, per knowledge/05 "Subject-ID identity mapping". */
export class ExternalAuthIdentityRepository {
  private readonly model = getAuthModels().ExternalAuthIdentity;

  async findByProviderSubject(
    provider: string,
    providerSubjectId: string,
  ): Promise<ExternalAuthIdentityEntity | null> {
    const instance = await this.model.findOne({ where: { provider, providerSubjectId } });
    return instance ? toEntity(instance) : null;
  }

  async findByUserId(userId: string): Promise<ExternalAuthIdentityEntity | null> {
    const instance = await this.model.findOne({ where: { userId } });
    return instance ? toEntity(instance) : null;
  }

  /** Auto-linked on a pre-provisioned user's first successful Google login — never creates the `users` row itself. */
  async link(input: {
    userId: string;
    provider: string;
    providerSubjectId: string;
    workspaceDomain: string;
  }): Promise<ExternalAuthIdentityEntity> {
    const instance = await this.model.create(input);
    return toEntity(instance);
  }
}
