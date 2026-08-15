import { Op, type Transaction } from "sequelize";
import { getProjectsModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ProjectConfidentiality, ProjectEntity, ProjectStatus } from "./entities.js";

const DATE_FIELDS = ["createdAt", "updatedAt"] as const;
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
    return toEntityWithIsoDates<ProjectEntity>(instance, DATE_FIELDS);
  }

  async findById(id: string): Promise<ProjectEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<ProjectEntity>(instance, DATE_FIELDS) : null;
  }

  async findByPublicId(publicId: string): Promise<ProjectEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<ProjectEntity>(instance, DATE_FIELDS) : null;
  }

  /** `transaction`, when given, lets `ProjectService.setActivePhase()` update `active_phase_id` as part of the same atomic unit as the roadmap-item status writes (code-review finding, `module-projects-foundation` branch). */
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
    transaction?: Transaction,
  ): Promise<ProjectEntity | null> {
    const instance = await this.model.findByPk(id, { transaction });
    if (!instance) {
      return null;
    }
    await instance.update(patch, { transaction });
    return toEntityWithIsoDates<ProjectEntity>(instance, DATE_FIELDS);
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
    return rows.map((row) => toEntityWithIsoDates<ProjectEntity>(row, DATE_FIELDS));
  }
}
