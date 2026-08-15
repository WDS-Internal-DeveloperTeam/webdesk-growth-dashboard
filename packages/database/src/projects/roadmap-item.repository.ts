import type { Model } from "sequelize";
import { getProjectsModels } from "./models.js";
import type { RoadmapItemEntity, RoadmapItemStatus } from "./entities.js";

function toEntity(instance: Model): RoadmapItemEntity {
  const json = instance.toJSON() as Record<string, unknown>;
  return {
    id: json.id as string,
    projectId: json.projectId as string,
    name: json.name as string,
    sequence: json.sequence as number,
    status: json.status as RoadmapItemStatus,
    createdBy: (json.createdBy as string | null) ?? null,
    updatedBy: (json.updatedBy as string | null) ?? null,
    createdAt: (json.createdAt as Date).toISOString(),
    updatedAt: (json.updatedAt as Date).toISOString(),
  };
}

export class RoadmapItemRepository {
  private readonly model = getProjectsModels().RoadmapItem;

  async create(input: {
    projectId: string;
    name: string;
    sequence?: number;
    createdBy?: string | null;
  }): Promise<RoadmapItemEntity> {
    const instance = await this.model.create({
      projectId: input.projectId,
      name: input.name,
      sequence: input.sequence ?? 0,
      status: "not_started",
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntity(instance);
  }

  async findById(id: string): Promise<RoadmapItemEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntity(instance) : null;
  }

  async update(
    id: string,
    patch: Partial<{
      name: string;
      sequence: number;
      status: RoadmapItemStatus;
      updatedBy: string | null;
    }>,
  ): Promise<RoadmapItemEntity | null> {
    const instance = await this.model.findByPk(id);
    if (!instance) {
      return null;
    }
    await instance.update(patch);
    return toEntity(instance);
  }

  async listByProject(projectId: string): Promise<readonly RoadmapItemEntity[]> {
    const rows = await this.model.findAll({
      where: { projectId },
      order: [["sequence", "ASC"]],
    });
    return rows.map(toEntity);
  }

  /**
   * Hard delete. Whether this is safe to call depends on a cross-table check the repository
   * layer doesn't own — `ProjectService.deleteRoadmapItem()` confirms the item isn't the
   * project's current `active_phase_id` before calling this (task package's "prevent destructive
   * deletion when dependent records exist" rule).
   */
  async remove(id: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id } });
    return count > 0;
  }
}
