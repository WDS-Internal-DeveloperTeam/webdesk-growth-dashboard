import { getIntegrationsModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { SecretMetadataEntity } from "./entities.js";

export interface SecretMetadataListFilter {
  readonly limit?: number;
  readonly offset?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** Server-only-managed columns excluded and derived, not hand-retyped, mirroring
 *  `IntegrationContentFields`'s own precedent — except `lastRotatedAt`/`rotationDueAt`, which the
 *  entity stores as an ISO string (`toEntityWithIsoDates`'s own output convention) but this
 *  repository's write path accepts as a real `Date` (the service layer's `toDate()` converts the
 *  DTO's ISO string before calling in), so those two are re-declared explicitly rather than
 *  `Omit<>`-derived from the entity's own read-shape. */
type SecretMetadataContentFields = Omit<
  SecretMetadataEntity,
  "id" | "integrationId" | "lastRotatedAt" | "rotationDueAt" | "createdAt" | "updatedAt"
> & {
  readonly lastRotatedAt?: Date | null;
  readonly rotationDueAt?: Date | null;
};

export class SecretMetadataRepository {
  private readonly model = getIntegrationsModels().SecretMetadata;

  async create(
    input: { integrationId: string } & Partial<SecretMetadataContentFields> &
      Pick<SecretMetadataContentFields, "secretName" | "storageLocation">,
  ): Promise<SecretMetadataEntity> {
    const instance = await this.model.create({
      integrationId: input.integrationId,
      secretName: input.secretName,
      storageLocation: input.storageLocation,
      lastRotatedAt: input.lastRotatedAt ?? null,
      rotationDueAt: input.rotationDueAt ?? null,
      notes: input.notes ?? null,
    });
    return toEntityWithIsoDates<SecretMetadataEntity>(instance);
  }

  /** `integrationId`-scoped for the same IDOR reason as
   *  `IntegrationEnvironmentRepository.findById()`'s own identical precedent. */
  async findById(id: string, integrationId: string): Promise<SecretMetadataEntity | null> {
    const instance = await this.model.findOne({ where: { id, integrationId } });
    return instance ? toEntityWithIsoDates<SecretMetadataEntity>(instance) : null;
  }

  async listByIntegration(
    integrationId: string,
    filter: SecretMetadataListFilter = {},
  ): Promise<readonly SecretMetadataEntity[]> {
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where: { integrationId },
      order: [["secretName", "ASC"]],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<SecretMetadataEntity>(row));
  }

  /** `integrationId` is required and included in the `where` clause — not just an id lookup —
   *  mirroring `ProjectEnvironmentRepository.update()`'s own identical IDOR-prevention fix. */
  async update(
    id: string,
    integrationId: string,
    patch: Partial<SecretMetadataContentFields>,
  ): Promise<SecretMetadataEntity | null> {
    const instance = await this.model.findOne({ where: { id, integrationId } });
    if (!instance) {
      return null;
    }
    await instance.update(patch);
    return toEntityWithIsoDates<SecretMetadataEntity>(instance);
  }

  /** Hard delete — pure metadata, no compliance/audit reason to retain a deleted row (D-schema).
   *  `integrationId`-scoped for the same IDOR reason as `update()` above. */
  async remove(id: string, integrationId: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id, integrationId } });
    return count > 0;
  }
}
