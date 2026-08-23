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

  /**
   * A narrow, read-only existence check for another module's `roadmapPhaseId`-style field —
   * `RoadmapItemRepository.findById()` itself isn't projectId-scoped (reads aren't IDOR-sensitive
   * the same way writes are), so the project match is checked here instead, ensuring a caller can
   * only reference a roadmap item that actually belongs to the same project as whatever record is
   * pointing at it (Page Inventory's `pages.roadmap_phase_id`, task package D6). Mirrors
   * `ServicesService.existingServiceIds()`'s own "narrow, read-only delegating method, not the
   * write-capable repository token directly" precedent — `RoadmapItemsService` itself, not
   * `RoadmapItemRepository`/`ROADMAP_ITEM_REPOSITORY`, is what `ProjectsModule` exports for this.
   */
  async existsInProject(id: string, projectId: string): Promise<boolean> {
    const item = await this.roadmapItems.findById(id);
    return item !== null && item.projectId === projectId;
  }

  /**
   * Only `name`/`sequence` are ever forwarded to the repository, explicitly, never a spread of the
   * caller's raw input — `status` (part of the wider `UpdateRoadmapItemDto`) must never reach this
   * method's write path. Setting an item `active` is only ever valid through
   * `ProjectService.setActivePhase()`, which also updates `projects.active_phase_id` and records an
   * audit event; letting a generic update silently flip `status` would desync that pointer and skip
   * the audit trail entirely (code-review finding, `module-projects-foundation` branch).
   */
  async update(
    id: string,
    projectId: string,
    patch: { name?: string; sequence?: number },
    actorUserId: string,
  ): Promise<RoadmapItemEntity> {
    const safePatch = { name: patch.name, sequence: patch.sequence, updatedBy: actorUserId };
    const updated = await this.roadmapItems.update(id, projectId, safePatch);
    if (!updated) {
      throw new NotFoundException(`Roadmap item not found: ${id}`);
    }
    return updated;
  }

  async remove(id: string, projectId: string, actorUserId: string): Promise<void> {
    const item = await this.findById(id);
    if (item.projectId !== projectId) {
      throw new NotFoundException(`Roadmap item not found: ${id}`);
    }
    const project = await this.projects.findById(projectId);
    if (project?.activePhaseId === id) {
      throw new BadRequestException(
        "Cannot remove a roadmap item that is the project's active phase — reassign or clear the active phase first",
      );
    }

    await this.roadmapItems.remove(id, projectId);

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
