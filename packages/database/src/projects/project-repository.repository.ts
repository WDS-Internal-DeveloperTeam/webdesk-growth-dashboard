import type { Model } from "sequelize";
import { getProjectsModels } from "./models.js";
import type { ProjectRepositoryEntity, RepositoryProvider } from "./entities.js";

function toEntity(instance: Model): ProjectRepositoryEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    projectId: json.projectId as string,
    provider: json.provider as RepositoryProvider,
    repoOwner: json.repoOwner as string,
    repoName: json.repoName as string,
    defaultBranch: json.defaultBranch as string,
    notes: (json.notes as string | null) ?? null,
    createdBy: (json.createdBy as string | null) ?? null,
    updatedBy: (json.updatedBy as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

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
      provider: "github",
      repoOwner: input.repoOwner,
      repoName: input.repoName,
      defaultBranch: input.defaultBranch ?? "main",
      notes: input.notes ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntity(instance);
  }

  async findById(id: string): Promise<ProjectRepositoryEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntity(instance) : null;
  }

  async update(
    id: string,
    patch: Partial<{
      repoOwner: string;
      repoName: string;
      defaultBranch: string;
      notes: string | null;
      updatedBy: string | null;
    }>,
  ): Promise<ProjectRepositoryEntity | null> {
    const instance = await this.model.findByPk(id);
    if (!instance) {
      return null;
    }
    await instance.update(patch);
    return toEntity(instance);
  }

  async listByProject(projectId: string): Promise<readonly ProjectRepositoryEntity[]> {
    const rows = await this.model.findAll({ where: { projectId }, order: [["repoName", "ASC"]] });
    return rows.map(toEntity);
  }

  /** Hard delete — safe here: no other table references a `project_repositories` row (task package §26). */
  async remove(id: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id } });
    return count > 0;
  }
}
