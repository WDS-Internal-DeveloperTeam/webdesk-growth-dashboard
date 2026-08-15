import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ProjectUserEntity, ProjectUserRepository } from "@webdesk/database";
import { PROJECT_USER_REPOSITORY } from "./projects.constants.js";

/**
 * The project team roster (task package D4) — grants no authorization by itself. Actual
 * project-scoped access continues to use the existing `user_roles.project_id` mechanism
 * (Phase 1D-expanded's `RoleAssignmentService`, unchanged by this module) — this service only
 * records "who's associated with this project."
 */
@Injectable()
export class ProjectTeamService {
  constructor(@Inject(PROJECT_USER_REPOSITORY) private readonly team: ProjectUserRepository) {}

  async add(projectId: string, userId: string, actorUserId: string): Promise<ProjectUserEntity> {
    const existing = await this.team.findByProjectAndUser(projectId, userId);
    if (existing) {
      throw new BadRequestException(`User already on project team: ${userId}`);
    }
    return this.team.add({ projectId, userId, addedBy: actorUserId });
  }

  async listByProject(projectId: string): Promise<readonly ProjectUserEntity[]> {
    return this.team.listByProject(projectId);
  }

  async remove(id: string, projectId: string): Promise<void> {
    const removed = await this.team.remove(id, projectId);
    if (!removed) {
      throw new NotFoundException(`Project team entry not found: ${id}`);
    }
  }
}
