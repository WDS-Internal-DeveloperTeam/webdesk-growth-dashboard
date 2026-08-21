import { getServiceLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { EngagementModelEntity } from "./entities.js";

export class EngagementModelRepository {
  private readonly model = getServiceLibraryModels().EngagementModel;

  async create(input: {
    publicId: string;
    name: string;
    description?: string | null;
    preferred?: boolean;
    approvalRequired?: boolean;
  }): Promise<EngagementModelEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      name: input.name,
      description: input.description ?? null,
      preferred: input.preferred ?? false,
      approvalRequired: input.approvalRequired ?? false,
    });
    return toEntityWithIsoDates<EngagementModelEntity>(instance);
  }

  async findById(id: string): Promise<EngagementModelEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<EngagementModelEntity>(instance) : null;
  }

  async findByIds(ids: readonly string[]): Promise<readonly EngagementModelEntity[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.model.findAll({ where: { id: ids } });
    return rows.map((row) => toEntityWithIsoDates<EngagementModelEntity>(row));
  }

  async list(): Promise<readonly EngagementModelEntity[]> {
    const rows = await this.model.findAll({ order: [["name", "ASC"]] });
    return rows.map((row) => toEntityWithIsoDates<EngagementModelEntity>(row));
  }
}
