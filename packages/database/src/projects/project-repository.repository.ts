import { getProjectsModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ProjectRepositoryEntity } from "./entities.js";

const DATE_FIELDS = ["createdAt", "updatedAt"] as const;

/** Named `...RepositoryRepository` deliberately — wraps the `ProjectRepository` model (the `project_repositories` table), following the same `<Model>Repository` convention every other repository class in this package uses. */
export class ProjectRepositoryRepository {
  private readonly model = getProjectsModels().ProjectRepository;

  async create(input: {
    projectId: string;
    repoOwner: string;
    repoName: string;
    defaultBranch?: string;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<ProjectRepositoryEntity> {
    const instance = await this.model.create({
      projectId: input.projectId,
      repoOwner: input.repoOwner,
      repoName: input.repoName,
      defaultBranch: input.defaultBranch ?? "main",
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<ProjectRepositoryEntity>(instance, DATE_FIELDS);
  }

  /** `projectId`-scoped — see `ProjectEnvironmentRepository.update()`'s doc comment for why (IDOR fix). */
  async update(
    id: string,
    projectId: string,
    patch: Partial<{
      repoOwner: string;
      repoName: string;
      defaultBranch: string;
      notes: string | null;
      updatedBy: string | null;
    }>,
  ): Promise<ProjectRepositoryEntity | null> {
    const instance = await this.model.findOne({ where: { id, projectId } });
    if (!instance) {
      return null;
    }
    await instance.update(patch);
    return toEntityWithIsoDates<ProjectRepositoryEntity>(instance, DATE_FIELDS);
  }

  async listByProject(projectId: string): Promise<readonly ProjectRepositoryEntity[]> {
    const rows = await this.model.findAll({ where: { projectId }, order: [["repoName", "ASC"]] });
    return rows.map((row) => toEntityWithIsoDates<ProjectRepositoryEntity>(row, DATE_FIELDS));
  }

  /** Hard delete — safe here: no other table references a `project_repositories` row (task package §26). `projectId`-scoped (IDOR fix). */
  async remove(id: string, projectId: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id, projectId } });
    return count > 0;
  }
}
