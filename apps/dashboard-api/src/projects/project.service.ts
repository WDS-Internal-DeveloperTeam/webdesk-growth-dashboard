import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { withTransaction } from "@webdesk/database";
import type {
  ProjectConfidentiality,
  ProjectEntity,
  ProjectRepository,
  ProjectStatus,
  RoadmapItemRepository,
} from "@webdesk/database";
import { PROJECT_REPOSITORY, ROADMAP_ITEM_REPOSITORY } from "./projects.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime, see google-auth.service.ts's note.
import { AuditService } from "../audit/audit.service.js";

export interface CreateProjectInput {
  publicId: string;
  name: string;
  description?: string | null;
  ownerUserId?: string | null;
  confidentiality?: ProjectConfidentiality;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  ownerUserId?: string | null;
  confidentiality?: ProjectConfidentiality;
}

export interface ListProjectsInput {
  status?: ProjectStatus;
  search?: string;
  sortBy?: "name" | "status" | "createdAt" | "updatedAt";
  sortOrder?: "ASC" | "DESC";
  limit?: number;
  offset?: number;
}

/** D2's controlled transition set — `archived` is terminal, `active`/`paused` toggle freely. */
const ALLOWED_TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  active: ["paused", "archived"],
  paused: ["active", "archived"],
  archived: [],
};

/**
 * Core Project CRUD + the two controlled state transitions the module spec names as their own
 * actions (task package §7): status change and active-phase assignment. Neither is a raw field
 * PATCH — both are dedicated methods that enforce the invariants design decisions D2/D3
 * established. There is deliberately no `delete()` method — Projects are archived, never hard-
 * deleted (task package rule 8, ADR-0016's project-wide no-hard-delete policy), which by itself
 * satisfies "prevent destructive deletion of a project."
 */
@Injectable()
export class ProjectService {
  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(ROADMAP_ITEM_REPOSITORY) private readonly roadmapItems: RoadmapItemRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateProjectInput, actorUserId: string): Promise<ProjectEntity> {
    const existing = await this.projects.findByPublicId(input.publicId);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    const project = await this.projects.create({
      publicId: input.publicId,
      name: input.name,
      description: input.description ?? null,
      ownerUserId: input.ownerUserId ?? null,
      confidentiality: input.confidentiality,
      createdBy: actorUserId,
    });

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId: project.id,
      entityType: "project",
      entityId: project.id,
      action: "create",
      afterState: { name: project.name, status: project.status },
      retentionCategory: "audit-7y",
    });

    return project;
  }

  async findById(id: string): Promise<ProjectEntity> {
    const project = await this.projects.findById(id);
    if (!project) {
      throw new NotFoundException(`Project not found: ${id}`);
    }
    return project;
  }

  async list(filter: ListProjectsInput = {}): Promise<readonly ProjectEntity[]> {
    return this.projects.list(filter);
  }

  async update(id: string, patch: UpdateProjectInput, actorUserId: string): Promise<ProjectEntity> {
    await this.findById(id); // throws NotFoundException if missing
    const updated = await this.projects.update(id, { ...patch, updatedBy: actorUserId });
    if (!updated) {
      throw new NotFoundException(`Project not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId: id,
      entityType: "project",
      entityId: id,
      action: "update",
      afterState: patch as Record<string, unknown>,
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  /** D2 — a controlled transition, never a raw status field write. */
  async changeStatus(
    id: string,
    nextStatus: ProjectStatus,
    actorUserId: string,
  ): Promise<ProjectEntity> {
    const project = await this.findById(id);
    if (project.status === nextStatus) {
      return project; // no-op, not an error — re-requesting the current status is harmless
    }
    if (!ALLOWED_TRANSITIONS[project.status].includes(nextStatus)) {
      throw new BadRequestException(
        `Invalid project status transition: ${project.status} -> ${nextStatus}`,
      );
    }

    const updated = await this.projects.update(id, {
      status: nextStatus,
      updatedBy: actorUserId,
    });
    if (!updated) {
      throw new NotFoundException(`Project not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "project_status_changed",
      actorUserId,
      actorType: "human",
      projectId: id,
      entityType: "project",
      entityId: id,
      action: "status_change",
      beforeState: { status: project.status },
      afterState: { status: nextStatus },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  /**
   * D3 — sets which roadmap item is "active" for this project, keeping the database's own
   * partial-unique-index invariant (at most one `active` roadmap item per project) satisfied by
   * clearing the previous active item first. Wrapped in `withTransaction()` (code-review finding,
   * `module-projects-foundation` branch — the previous sequential, non-transactional writes could
   * leave `active_phase_id` pointing at an item whose own status had already been reset to
   * `not_started` if a later write failed) so all three writes commit or roll back together.
   */
  async setActivePhase(
    id: string,
    roadmapItemId: string | null,
    actorUserId: string,
  ): Promise<ProjectEntity> {
    const project = await this.findById(id);

    if (roadmapItemId !== null) {
      const item = await this.roadmapItems.findById(roadmapItemId);
      if (!item || item.projectId !== id) {
        throw new BadRequestException(
          `roadmapItemId does not belong to project ${id}: ${roadmapItemId}`,
        );
      }
    }

    const updated = await withTransaction(async (transaction) => {
      if (project.activePhaseId && project.activePhaseId !== roadmapItemId) {
        await this.roadmapItems.update(
          project.activePhaseId,
          id,
          { status: "not_started", updatedBy: actorUserId },
          transaction,
        );
      }
      if (roadmapItemId !== null) {
        await this.roadmapItems.update(
          roadmapItemId,
          id,
          { status: "active", updatedBy: actorUserId },
          transaction,
        );
      }

      return this.projects.update(
        id,
        { activePhaseId: roadmapItemId, updatedBy: actorUserId },
        transaction,
      );
    });
    if (!updated) {
      throw new NotFoundException(`Project not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId: id,
      entityType: "project",
      entityId: id,
      action: "set_active_phase",
      beforeState: { activePhaseId: project.activePhaseId },
      afterState: { activePhaseId: roadmapItemId },
      retentionCategory: "audit-7y",
    });

    return updated;
  }
}
