import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ObjectiveStatus,
  ProjectObjectiveEntity,
  ProjectObjectiveRepository,
} from "@webdesk/database";
import { PROJECT_OBJECTIVE_REPOSITORY } from "./projects.constants.js";

/** Project-objective CRUD. No other table references a row here, so removal needs no dependent-record guard (task package §26). */
@Injectable()
export class ProjectObjectivesService {
  constructor(
    @Inject(PROJECT_OBJECTIVE_REPOSITORY) private readonly objectives: ProjectObjectiveRepository,
  ) {}

  async create(
    projectId: string,
    description: string,
    actorUserId: string,
  ): Promise<ProjectObjectiveEntity> {
    return this.objectives.create({ projectId, description, createdBy: actorUserId });
  }

  async listByProject(projectId: string): Promise<readonly ProjectObjectiveEntity[]> {
    return this.objectives.listByProject(projectId);
  }

  async update(
    id: string,
    patch: { description?: string; status?: ObjectiveStatus },
    actorUserId: string,
  ): Promise<ProjectObjectiveEntity> {
    const updated = await this.objectives.update(id, { ...patch, updatedBy: actorUserId });
    if (!updated) {
      throw new NotFoundException(`Project objective not found: ${id}`);
    }
    return updated;
  }

  async remove(id: string): Promise<void> {
    const removed = await this.objectives.remove(id);
    if (!removed) {
      throw new NotFoundException(`Project objective not found: ${id}`);
    }
  }
}
