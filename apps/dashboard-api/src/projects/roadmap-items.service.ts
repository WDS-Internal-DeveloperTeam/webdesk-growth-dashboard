import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ProjectRepository,
  RoadmapItemEntity,
  RoadmapItemRepository,
} from "@webdesk/database";
import { PROJECT_REPOSITORY, ROADMAP_ITEM_REPOSITORY } from "./projects.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";

/**
 * Roadmap-item CRUD, including the one real "destructive deletion when dependent records exist"
 * check this schema has: a roadmap item currently referenced as its project's `active_phase_id`
 * cannot be removed until the project's active phase is reassigned or cleared via
 * `ProjectService.setActivePhase()` first (task package rule 3/`§26`). No other table in this
 * module references a `roadmap_items` row, so this is the only guard actually needed here.
 */
@Injectable()
export class RoadmapItemsService {
  constructor(
    @Inject(ROADMAP_ITEM_REPOSITORY) private readonly roadmapItems: RoadmapItemRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(
    projectId: string,
    input: { name: string; sequence?: number },
    actorUserId: string,
  ): Promise<RoadmapItemEntity> {
    return this.roadmapItems.create({
      projectId,
      name: input.name,
      sequence: input.sequence,
      createdBy: actorUserId,
    });
  }

  async findById(id: string): Promise<RoadmapItemEntity> {
    const item = await this.roadmapItems.findById(id);
    if (!item) {
      throw new NotFoundException(`Roadmap item not found: ${id}`);
    }
    return item;
  }

  async listByProject(projectId: string): Promise<readonly RoadmapItemEntity[]> {
    return this.roadmapItems.listByProject(projectId);
  }

  async update(
    id: string,
    patch: { name?: string; sequence?: number },
    actorUserId: string,
  ): Promise<RoadmapItemEntity> {
    await this.findById(id);
    const updated = await this.roadmapItems.update(id, { ...patch, updatedBy: actorUserId });
    if (!updated) {
      throw new NotFoundException(`Roadmap item not found: ${id}`);
    }
    return updated;
  }

  async remove(id: string, actorUserId: string): Promise<void> {
    const item = await this.findById(id);
    const project = await this.projects.findById(item.projectId);
    if (project?.activePhaseId === id) {
      throw new BadRequestException(
        "Cannot remove a roadmap item that is the project's active phase — reassign or clear the active phase first",
      );
    }

    await this.roadmapItems.remove(id);

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId: item.projectId,
      entityType: "roadmap_item",
      entityId: id,
      action: "delete",
      beforeState: { name: item.name },
      retentionCategory: "audit-7y",
    });
  }
}
