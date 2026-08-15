import { getProjectsModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ProjectEnvironmentEntity } from "./entities.js";

const DATE_FIELDS = ["createdAt", "updatedAt"] as const;

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
    return toEntityWithIsoDates<ProjectEnvironmentEntity>(instance, DATE_FIELDS);
  }

  /**
   * `projectId` is required and included in the `where` clause — not just an id lookup — so a
   * caller authorized against one project can never mutate a row belonging to another (code-review
   * finding: IDOR via unscoped `findByPk`/`destroy`, `module-projects-foundation` branch).
   */
  async update(
    id: string,
    projectId: string,
    patch: Partial<{
      name: string;
      url: string | null;
      notes: string | null;
      updatedBy: string | null;
    }>,
  ): Promise<ProjectEnvironmentEntity | null> {
    const instance = await this.model.findOne({ where: { id, projectId } });
    if (!instance) {
      return null;
    }
    await instance.update(patch);
    return toEntityWithIsoDates<ProjectEnvironmentEntity>(instance, DATE_FIELDS);
  }

  async listByProject(projectId: string): Promise<readonly ProjectEnvironmentEntity[]> {
    const rows = await this.model.findAll({ where: { projectId }, order: [["name", "ASC"]] });
    return rows.map((row) => toEntityWithIsoDates<ProjectEnvironmentEntity>(row, DATE_FIELDS));
  }

  /** Hard delete — safe here: no other table references a `project_environments` row (task package §26). `projectId`-scoped for the same IDOR reason as `update()` above. */
  async remove(id: string, projectId: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id, projectId } });
    return count > 0;
  }
}
