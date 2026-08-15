import type { Model } from "sequelize";
import { getProjectsModels } from "./models.js";
import type { ObjectiveStatus, ProjectObjectiveEntity } from "./entities.js";

function toEntity(instance: Model): ProjectObjectiveEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    projectId: json.projectId as string,
    description: json.description as string,
    status: json.status as ObjectiveStatus,
    createdBy: (json.createdBy as string | null) ?? null,
    updatedBy: (json.updatedBy as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

export class ProjectObjectiveRepository {
  private readonly model = getProjectsModels().ProjectObjective;

  async create(input: {
    projectId: string;
    description: string;
    createdBy?: string | null;
  }): Promise<ProjectObjectiveEntity> {
    const instance = await this.model.create({
      projectId: input.projectId,
      description: input.description,
      status: "open",
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntity(instance);
  }

  async findById(id: string): Promise<ProjectObjectiveEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntity(instance) : null;
  }

  async update(
    id: string,
    patch: Partial<{ description: string; status: ObjectiveStatus; updatedBy: string | null }>,
  ): Promise<ProjectObjectiveEntity | null> {
    const instance = await this.model.findByPk(id);
    if (!instance) {
      return null;
    }
    await instance.update(patch);
    return toEntity(instance);
  }

  async listByProject(projectId: string): Promise<readonly ProjectObjectiveEntity[]> {
    const rows = await this.model.findAll({ where: { projectId }, order: [["createdAt", "ASC"]] });
    return rows.map(toEntity);
  }

  /** Hard delete — safe here: no other table references a `project_objectives` row (task package §26). */
  async remove(id: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id } });
    return count > 0;
  }
}
