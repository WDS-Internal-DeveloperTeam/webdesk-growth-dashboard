import { getProjectsModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ProjectUserEntity } from "./entities.js";

const DATE_FIELDS = ["addedAt"] as const;

/** The project team roster — grants no authorization by itself (task package D4). */
export class ProjectUserRepository {
  private readonly model = getProjectsModels().ProjectUser;

  async add(input: {
    projectId: string;
    userId: string;
    addedBy?: string | null;
  }): Promise<ProjectUserEntity> {
    const instance = await this.model.create({
      projectId: input.projectId,
      userId: input.userId,
      addedBy: input.addedBy ?? null,
    });
    return toEntityWithIsoDates<ProjectUserEntity>(instance, DATE_FIELDS);
  }

  async findByProjectAndUser(projectId: string, userId: string): Promise<ProjectUserEntity | null> {
    const instance = await this.model.findOne({ where: { projectId, userId } });
    return instance ? toEntityWithIsoDates<ProjectUserEntity>(instance, DATE_FIELDS) : null;
  }

  async listByProject(projectId: string): Promise<readonly ProjectUserEntity[]> {
    const rows = await this.model.findAll({ where: { projectId }, order: [["addedAt", "ASC"]] });
    return rows.map((row) => toEntityWithIsoDates<ProjectUserEntity>(row, DATE_FIELDS));
  }

  /** Hard delete — safe here: nothing else references a roster row directly (task package §26); the user's own project-scoped authorization, if any, lives separately in `user_roles` and is not affected by removing this roster entry. `projectId`-scoped (IDOR fix — see `ProjectEnvironmentRepository.update()`'s doc comment). */
  async remove(id: string, projectId: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id, projectId } });
    return count > 0;
  }
}
