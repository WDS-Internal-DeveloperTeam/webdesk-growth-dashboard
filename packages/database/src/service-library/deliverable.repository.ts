import { getServiceLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { DeliverableEntity } from "./entities.js";

export class DeliverableRepository {
  private readonly model = getServiceLibraryModels().Deliverable;

  async create(input: {
    publicId: string;
    name: string;
    description?: string | null;
  }): Promise<DeliverableEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      name: input.name,
      description: input.description ?? null,
    });
    return toEntityWithIsoDates<DeliverableEntity>(instance);
  }

  async findById(id: string): Promise<DeliverableEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<DeliverableEntity>(instance) : null;
  }

  async findByIds(ids: readonly string[]): Promise<readonly DeliverableEntity[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.model.findAll({ where: { id: ids } });
    return rows.map((row) => toEntityWithIsoDates<DeliverableEntity>(row));
  }

  async list(): Promise<readonly DeliverableEntity[]> {
    const rows = await this.model.findAll({ order: [["name", "ASC"]] });
    return rows.map((row) => toEntityWithIsoDates<DeliverableEntity>(row));
  }
}
