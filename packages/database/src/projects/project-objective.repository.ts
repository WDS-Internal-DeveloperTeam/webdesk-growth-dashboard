import { getProjectsModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ObjectiveStatus, ProjectObjectiveEntity } from "./entities.js";

const DATE_FIELDS = ["createdAt", "updatedAt"] as const;

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
    return toEntityWithIsoDates<ProjectObjectiveEntity>(instance, DATE_FIELDS);
  }

  /** `projectId`-scoped — see `ProjectEnvironmentRepository.update()`'s doc comment for why (IDOR fix). */
  async update(
    id: string,
    projectId: string,
    patch: Partial<{ description: string; status: ObjectiveStatus; updatedBy: string | null }>,
  ): Promise<ProjectObjectiveEntity | null> {
    const instance = await this.model.findOne({ where: { id, projectId } });
    if (!instance) {
      return null;
    }
    await instance.update(patch);
    return toEntityWithIsoDates<ProjectObjectiveEntity>(instance, DATE_FIELDS);
  }

  async listByProject(projectId: string): Promise<readonly ProjectObjectiveEntity[]> {
    const rows = await this.model.findAll({ where: { projectId }, order: [["createdAt", "ASC"]] });
    return rows.map((row) => toEntityWithIsoDates<ProjectObjectiveEntity>(row, DATE_FIELDS));
  }

  /** Hard delete — safe here: no other table references a `project_objectives` row (task package §26). `projectId`-scoped (IDOR fix). */
  async remove(id: string, projectId: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id, projectId } });
    return count > 0;
  }
}
