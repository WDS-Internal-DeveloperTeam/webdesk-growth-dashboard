import type { Transaction } from "sequelize";
import { getProjectsModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { RoadmapItemEntity, RoadmapItemStatus } from "./entities.js";

const DATE_FIELDS = ["createdAt", "updatedAt"] as const;

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
    return toEntityWithIsoDates<RoadmapItemEntity>(instance, DATE_FIELDS);
  }

  async findById(id: string): Promise<RoadmapItemEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<RoadmapItemEntity>(instance, DATE_FIELDS) : null;
  }

  /**
   * `projectId`-scoped — see `ProjectEnvironmentRepository.update()`'s doc comment for why (IDOR
   * fix). `transaction`, when given, lets `ProjectService.setActivePhase()` wrap its multi-row
   * active-phase update in a single atomic unit instead of the previous sequential, non-transactional
   * writes (code-review finding, `module-projects-foundation` branch).
   */
  async update(
    id: string,
    projectId: string,
    patch: Partial<{
      name: string;
      sequence: number;
      status: RoadmapItemStatus;
      updatedBy: string | null;
    }>,
    transaction?: Transaction,
  ): Promise<RoadmapItemEntity | null> {
    const instance = await this.model.findOne({ where: { id, projectId }, transaction });
    if (!instance) {
      return null;
    }
    await instance.update(patch, { transaction });
    return toEntityWithIsoDates<RoadmapItemEntity>(instance, DATE_FIELDS);
  }

  async listByProject(projectId: string): Promise<readonly RoadmapItemEntity[]> {
    const rows = await this.model.findAll({
      where: { projectId },
      order: [["sequence", "ASC"]],
    });
    return rows.map((row) => toEntityWithIsoDates<RoadmapItemEntity>(row, DATE_FIELDS));
  }

  /**
   * Hard delete. Whether this is safe to call depends on a cross-table check the repository
   * layer doesn't own — `RoadmapItemsService.remove()` confirms the item isn't the project's
   * current `active_phase_id` before calling this (task package's "prevent destructive
   * deletion when dependent records exist" rule). `projectId`-scoped (IDOR fix).
   */
  async remove(id: string, projectId: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id, projectId } });
    return count > 0;
  }
}
