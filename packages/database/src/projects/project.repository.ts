import { Op, type Model } from "sequelize";
import { getProjectsModels } from "./models.js";
import type { ProjectConfidentiality, ProjectEntity, ProjectStatus } from "./entities.js";

function toEntity(instance: Model): ProjectEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    publicId: json.publicId as string,
    name: json.name as string,
    description: (json.description as string | null) ?? null,
    status: json.status as ProjectStatus,
    activePhaseId: (json.activePhaseId as string | null) ?? null,
    ownerUserId: (json.ownerUserId as string | null) ?? null,
    confidentiality: json.confidentiality as ProjectConfidentiality,
    retentionCategory: (json.retentionCategory as string | null) ?? null,
    createdBy: (json.createdBy as string | null) ?? null,
    updatedBy: (json.updatedBy as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export class ProjectRepository {
  private readonly model = getProjectsModels().Project;

  async create(input: {
    publicId: string;
    name: string;
    description?: string | null;
    ownerUserId?: string | null;
    confidentiality?: ProjectConfidentiality;
    createdBy?: string | null;
  }): Promise<ProjectEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      name: input.name,
      description: input.description ?? null,
      status: "active",
      ownerUserId: input.ownerUserId ?? null,
      confidentiality: input.confidentiality ?? "internal",
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntity(instance);
  }

  async findById(id: string): Promise<ProjectEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntity(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<ProjectEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntity(instance) : null;
  }

  async update(
    id: string,
    patch: Partial<{
      name: string;
      description: string | null;
      status: ProjectStatus;
      activePhaseId: string | null;
      ownerUserId: string | null;
      confidentiality: ProjectConfidentiality;
      retentionCategory: string | null;
      updatedBy: string | null;
    }>,
  ): Promise<ProjectEntity | null> {
    const instance = await this.model.findByPk(id);
    if (!instance) {
      return null;
    }
    await instance.update(patch);
    return toEntity(instance);
  }

  async list(
    filter: {
      status?: ProjectStatus;
      search?: string;
      sortBy?: "name" | "status" | "createdAt" | "updatedAt";
      sortOrder?: "ASC" | "DESC";
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<readonly ProjectEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.search) {
      where.name = { [Op.iLike]: `%${filter.search}%` };
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      order: [[filter.sortBy ?? "updatedAt", filter.sortOrder ?? "DESC"]],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map(toEntity);
  }
}
