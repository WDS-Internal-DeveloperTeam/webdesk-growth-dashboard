import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ProjectEnvironmentEntity, ProjectEnvironmentRepository } from "@webdesk/database";
import { PROJECT_ENVIRONMENT_REPOSITORY } from "./projects.constants.js";

/** Environment metadata CRUD — reference/display only, no credentials (task package rule 10). No other table references a row here, so removal needs no dependent-record guard (task package §26). */
@Injectable()
export class ProjectEnvironmentsService {
  constructor(
    @Inject(PROJECT_ENVIRONMENT_REPOSITORY)
    private readonly environments: ProjectEnvironmentRepository,
  ) {}

  async create(
    projectId: string,
    input: { name: string; url?: string | null; notes?: string | null },
    actorUserId: string,
  ): Promise<ProjectEnvironmentEntity> {
    return this.environments.create({ projectId, ...input, createdBy: actorUserId });
  }

  async listByProject(projectId: string): Promise<readonly ProjectEnvironmentEntity[]> {
    return this.environments.listByProject(projectId);
  }

  async update(
    id: string,
    patch: { name?: string; url?: string | null; notes?: string | null },
    actorUserId: string,
  ): Promise<ProjectEnvironmentEntity> {
    const updated = await this.environments.update(id, { ...patch, updatedBy: actorUserId });
    if (!updated) {
      throw new NotFoundException(`Project environment not found: ${id}`);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const removed = await this.environments.remove(id);
    if (!removed) {
      throw new NotFoundException(`Project environment not found: ${id}`);
    }
  }
}
