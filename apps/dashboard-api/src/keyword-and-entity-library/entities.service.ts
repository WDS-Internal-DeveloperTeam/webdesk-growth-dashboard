import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  EntityRecordEntity,
  EntityRecordListFilter,
  EntityRepository,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import { ENTITY_REPOSITORY } from "./keyword-and-entity-library.constants.js";
import type { CreateEntityDto, UpdateEntityDto } from "./keyword-and-entity-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ProjectService } from "../projects/project.service.js";

/**
 * `entities` CRUD — lightweight, project-scoped reference records with no approval workflow of
 * their own (task package D3), mirroring `KeywordsService`'s own project-scoping/IDOR-prevention
 * discipline but without any `TRANSITIONS`/status machinery.
 */
@Injectable()
export class EntitiesService {
  constructor(
    @Inject(ENTITY_REPOSITORY) private readonly entities: EntityRepository,
    private readonly projects: ProjectService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    projectId: string,
    input: CreateEntityDto,
    actorUserId: string,
  ): Promise<EntityRecordEntity> {
    const [existing] = await Promise.all([
      this.entities.findByPublicId(input.publicId),
      this.projects.findById(projectId),
    ]);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: EntityRecordEntity;
    try {
      created = await this.entities.create({ ...input, projectId, createdBy: actorUserId });
    } catch (error) {
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(`publicId already in use: ${input.publicId}`);
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId: created.projectId,
      entityType: "entity",
      entityId: created.id,
      action: "create",
      afterState: { name: created.name },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  /** `projectId`-scoped (IDOR prevention). */
  async findById(id: string, projectId: string): Promise<EntityRecordEntity> {
    const entity = await this.entities.findById(id);
    if (!entity || entity.projectId !== projectId) {
      throw new NotFoundException(`Entity not found: ${id}`);
    }
    return entity;
  }

  async list(
    projectId: string,
    filter: Omit<EntityRecordListFilter, "projectId">,
  ): Promise<readonly EntityRecordEntity[]> {
    return this.entities.list({ ...filter, projectId });
  }

  async update(
    id: string,
    projectId: string,
    patch: UpdateEntityDto,
    actorUserId: string,
  ): Promise<EntityRecordEntity> {
    // Pre-fetch for the same "404 before any write, including a cross-project id" reason
    // KeywordsService.update()/PagesService.update() both establish — no CAS guard needed here,
    // entities have no approval workflow (task package D3).
    await this.findById(id, projectId);

    const updated = await this.entities.update(id, { ...patch, updatedBy: actorUserId });
    if (!updated) {
      throw new NotFoundException(`Entity not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId,
      entityType: "entity",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  /** `projectId`-scoped (IDOR prevention). Hard delete — entities are lightweight reference
   *  records, not audited artifacts (task package D3); any dependent
   *  `keyword_entity_relationships` rows are removed via `ON DELETE CASCADE`. */
  async remove(id: string, projectId: string, actorUserId: string): Promise<void> {
    const entity = await this.findById(id, projectId);

    const removed = await this.entities.remove(id, projectId);
    if (!removed) {
      throw new NotFoundException(`Entity not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId,
      entityType: "entity",
      entityId: id,
      action: "delete",
      beforeState: { name: entity.name },
      retentionCategory: "audit-7y",
    });
  }
}
