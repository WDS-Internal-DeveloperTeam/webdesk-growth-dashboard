import { getServiceLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ServiceCategoryEntity } from "./entities.js";

export class ServiceCategoryRepository {
  private readonly model = getServiceLibraryModels().ServiceCategory;

  async create(input: {
    publicId: string;
    name: string;
    parentCategoryId?: string | null;
    publicDescription?: string | null;
    internalDescription?: string | null;
    sortOrder?: number;
    createdBy?: string | null;
  }): Promise<ServiceCategoryEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      name: input.name,
      parentCategoryId: input.parentCategoryId ?? null,
      publicDescription: input.publicDescription ?? null,
      internalDescription: input.internalDescription ?? null,
      sortOrder: input.sortOrder ?? 0,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<ServiceCategoryEntity>(instance);
  }

  async findById(id: string): Promise<ServiceCategoryEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<ServiceCategoryEntity>(instance) : null;
  }

  async list(): Promise<readonly ServiceCategoryEntity[]> {
    const rows = await this.model.findAll({ order: [["sortOrder", "ASC"]] });
    return rows.map((row) => toEntityWithIsoDates<ServiceCategoryEntity>(row));
  }
}
