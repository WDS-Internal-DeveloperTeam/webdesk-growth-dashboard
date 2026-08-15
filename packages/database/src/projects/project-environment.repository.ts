import type { Model } from "sequelize";
import { getProjectsModels } from "./models.js";
import type { ProjectEnvironmentEntity } from "./entities.js";

function toEntity(instance: Model): ProjectEnvironmentEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    projectId: json.projectId as string,
    name: json.name as string,
    url: (json.url as string | null) ?? null,
    notes: (json.notes as string | null) ?? null,
    createdBy: (json.createdBy as string | null) ?? null,
    updatedBy: (json.updatedBy as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

export class ProjectEnvironmentRepository {
  private readonly model = getProjectsModels().ProjectEnvironment;

  async create(input: {
    projectId: string;
    name: string;
    url?: string | null;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<ProjectEnvironmentEntity> {
    const instance = await this.model.create({
      projectId: input.projectId,
      name: input.name,
      url: input.url ?? null,
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntity(instance);
  }

  async findById(id: string): Promise<ProjectEnvironmentEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntity(instance) : null;
  }

  async update(
    id: string,
    patch: Partial<{
      name: string;
      url: string | null;
      notes: string | null;
      updatedBy: string | null;
    }>,
  ): Promise<ProjectEnvironmentEntity | null> {
    const instance = await this.model.findByPk(id);
    if (!instance) {
      return null;
    }
    await instance.update(patch);
    return toEntity(instance);
  }

  async listByProject(projectId: string): Promise<readonly ProjectEnvironmentEntity[]> {
    const rows = await this.model.findAll({ where: { projectId }, order: [["name", "ASC"]] });
    return rows.map(toEntity);
  }

  /** Hard delete — safe here: no other table references a `project_environments` row (task package §26). */
  async remove(id: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id } });
    return count > 0;
  }
}
