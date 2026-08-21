import { getServiceLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { PlatformTechnologyEntity } from "./entities.js";

export class PlatformTechnologyRepository {
  private readonly model = getServiceLibraryModels().PlatformTechnology;

  async create(input: {
    publicId: string;
    name: string;
    description?: string | null;
    platformType?: string | null;
    certifiedPartnership?: boolean;
  }): Promise<PlatformTechnologyEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      name: input.name,
      description: input.description ?? null,
      platformType: input.platformType ?? null,
      certifiedPartnership: input.certifiedPartnership ?? false,
    });
    return toEntityWithIsoDates<PlatformTechnologyEntity>(instance);
  }

  async findById(id: string): Promise<PlatformTechnologyEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<PlatformTechnologyEntity>(instance) : null;
  }

  async findByIds(ids: readonly string[]): Promise<readonly PlatformTechnologyEntity[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.model.findAll({ where: { id: ids } });
    return rows.map((row) => toEntityWithIsoDates<PlatformTechnologyEntity>(row));
  }

  async list(): Promise<readonly PlatformTechnologyEntity[]> {
    const rows = await this.model.findAll({ order: [["name", "ASC"]] });
    return rows.map((row) => toEntityWithIsoDates<PlatformTechnologyEntity>(row));
  }
}
