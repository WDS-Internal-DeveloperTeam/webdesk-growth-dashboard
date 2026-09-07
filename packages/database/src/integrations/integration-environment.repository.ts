import { getIntegrationsModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { IntegrationEnvironmentEntity } from "./entities.js";

export interface IntegrationEnvironmentListFilter {
  readonly limit?: number;
  readonly offset?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** Server-only-managed columns excluded — derived, not hand-retyped, mirroring
 *  `IntegrationContentFields`'s own precedent one file over. `lastVerifiedAt` is likewise excluded
 *  from both `create()`'s and `update()`'s accepted shape below: no route/DTO in this pass exposes
 *  it, so it stays a real column with no live write path rather than an advertised-but-unreachable
 *  repository capability. */
type IntegrationEnvironmentContentFields = Omit<
  IntegrationEnvironmentEntity,
  "id" | "integrationId" | "lastVerifiedAt" | "createdAt" | "updatedAt"
>;

export class IntegrationEnvironmentRepository {
  private readonly model = getIntegrationsModels().IntegrationEnvironment;

  async create(
    input: { integrationId: string } & Partial<IntegrationEnvironmentContentFields> &
      Pick<IntegrationEnvironmentContentFields, "environmentName">,
  ): Promise<IntegrationEnvironmentEntity> {
    const instance = await this.model.create({
      integrationId: input.integrationId,
      environmentName: input.environmentName,
      status: input.status ?? "not_configured",
      configReference: input.configReference ?? null,
      notes: input.notes ?? null,
    });
    return toEntityWithIsoDates<IntegrationEnvironmentEntity>(instance);
  }

  /** `integrationId`-scoped for the same IDOR reason as `ProjectEnvironmentRepository.findById()`'s
   *  own identical precedent — a caller authorized against one integration can never read/mutate a
   *  row belonging to another. */
  async findById(id: string, integrationId: string): Promise<IntegrationEnvironmentEntity | null> {
    const instance = await this.model.findOne({ where: { id, integrationId } });
    return instance ? toEntityWithIsoDates<IntegrationEnvironmentEntity>(instance) : null;
  }

  async listByIntegration(
    integrationId: string,
    filter: IntegrationEnvironmentListFilter = {},
  ): Promise<readonly IntegrationEnvironmentEntity[]> {
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where: { integrationId },
      order: [["environmentName", "ASC"]],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<IntegrationEnvironmentEntity>(row));
  }

  /** `integrationId` is required and included in the `where` clause — not just an id lookup —
   *  mirroring `ProjectEnvironmentRepository.update()`'s own identical IDOR-prevention fix. */
  async update(
    id: string,
    integrationId: string,
    patch: Partial<IntegrationEnvironmentContentFields>,
  ): Promise<IntegrationEnvironmentEntity | null> {
    const instance = await this.model.findOne({ where: { id, integrationId } });
    if (!instance) {
      return null;
    }
    await instance.update(patch);
    return toEntityWithIsoDates<IntegrationEnvironmentEntity>(instance);
  }

  /** Hard delete — safe here: a config row, not a historical record needing retention.
   *  `integrationId`-scoped for the same IDOR reason as `update()` above. */
  async remove(id: string, integrationId: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id, integrationId } });
    return count > 0;
  }
}
