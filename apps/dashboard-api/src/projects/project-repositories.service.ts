import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ProjectRepositoryEntity, ProjectRepositoryRepository } from "@webdesk/database";
import { PROJECT_REPOSITORY_REPOSITORY } from "./projects.constants.js";

/** Repository-link metadata CRUD — no live GitHub API calls (task package D5). No other table references a row here, so removal needs no dependent-record guard (task package §26). */
@Injectable()
export class ProjectRepositoriesService {
  constructor(
    @Inject(PROJECT_REPOSITORY_REPOSITORY)
    private readonly repositories: ProjectRepositoryRepository,
  ) {}

  async create(
    projectId: string,
    input: { repoOwner: string; repoName: string; defaultBranch?: string; notes?: string | null },
    actorUserId: string,
  ): Promise<ProjectRepositoryEntity> {
    return this.repositories.create({ projectId, ...input, createdBy: actorUserId });
  }

  async listByProject(projectId: string): Promise<readonly ProjectRepositoryEntity[]> {
    return this.repositories.listByProject(projectId);
  }

  async update(
    id: string,
    projectId: string,
    patch: {
      repoOwner?: string;
      repoName?: string;
      defaultBranch?: string;
      notes?: string | null;
    },
    actorUserId: string,
  ): Promise<ProjectRepositoryEntity> {
    const updated = await this.repositories.update(id, projectId, {
      ...patch,
      updatedBy: actorUserId,
    });
    if (!updated) {
      throw new NotFoundException(`Project repository not found: ${id}`);
    }
    return updated;
  }

  async remove(id: string, projectId: string): Promise<void> {
    const removed = await this.repositories.remove(id, projectId);
    if (!removed) {
      throw new NotFoundException(`Project repository not found: ${id}`);
    }
  }
}
