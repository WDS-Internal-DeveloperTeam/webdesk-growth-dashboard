import type { Model } from "sequelize";
import { getProjectsModels } from "./models.js";
import type { ProjectUserEntity } from "./entities.js";

function toEntity(instance: Model): ProjectUserEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    projectId: json.projectId as string,
    userId: json.userId as string,
    addedAt: (json.addedAt as Date).toISOString(),
    addedBy: (json.addedBy as string | null) ?? null,
  };
}

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
    return toEntity(instance);
  }

  async findById(id: string): Promise<ProjectUserEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntity(instance) : null;
  }

  async findByProjectAndUser(projectId: string, userId: string): Promise<ProjectUserEntity | null> {
    const instance = await this.model.findOne({ where: { projectId, userId } });
    return instance ? toEntity(instance) : null;
  }

  async listByProject(projectId: string): Promise<readonly ProjectUserEntity[]> {
    const rows = await this.model.findAll({ where: { projectId }, order: [["addedAt", "ASC"]] });
    return rows.map(toEntity);
  }

  /** Hard delete — safe here: nothing else references a roster row directly (task package §26); the user's own project-scoped authorization, if any, lives separately in `user_roles` and is not affected by removing this roster entry. */
  async remove(id: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id } });
    return count > 0;
  }
}
