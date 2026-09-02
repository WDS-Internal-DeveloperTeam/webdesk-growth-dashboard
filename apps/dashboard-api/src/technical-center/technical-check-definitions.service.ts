import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  TechnicalCheckDefinitionEntity,
  TechnicalCheckDefinitionListFilter,
  TechnicalCheckDefinitionRepository,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import { TECHNICAL_CHECK_DEFINITION_REPOSITORY } from "./technical-center.constants.js";
import type {
  CreateTechnicalCheckDefinitionDto,
  UpdateTechnicalCheckDefinitionDto,
} from "./technical-center.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ProjectService } from "../projects/project.service.js";

@Injectable()
export class TechnicalCheckDefinitionsService {
  constructor(
    @Inject(TECHNICAL_CHECK_DEFINITION_REPOSITORY)
    private readonly definitions: TechnicalCheckDefinitionRepository,
    private readonly projects: ProjectService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    projectId: string,
    input: CreateTechnicalCheckDefinitionDto,
    actorUserId: string,
  ): Promise<TechnicalCheckDefinitionEntity> {
    const [, existing] = await Promise.all([
      this.projects.findById(projectId),
      this.definitions.findByPublicId(input.publicId),
    ]);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: TechnicalCheckDefinitionEntity;
    try {
      created = await this.definitions.create({
        ...input,
        projectId,
        createdBy: actorUserId,
      });
    } catch (error) {
      // The publicId uniqueness check above is TOCTOU — the real unique index catches the race
      // loser, but without this catch it would otherwise surface as a raw 500 instead of the same
      // clean 400 the check above already gives the non-racing caller.
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
      entityType: "technical_check_definition",
      entityId: created.id,
      action: "create",
      afterState: { name: created.name, checkType: created.checkType },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  /** `projectId`-scoped (IDOR prevention) — a definition from a different project, accessed via
   *  this project's own route, is treated as not found rather than silently returned/mutated. */
  async findById(id: string, projectId: string): Promise<TechnicalCheckDefinitionEntity> {
    const definition = await this.definitions.findById(id);
    if (!definition || definition.projectId !== projectId) {
      throw new NotFoundException(`Technical check definition not found: ${id}`);
    }
    return definition;
  }

  async list(
    filter: TechnicalCheckDefinitionListFilter,
  ): Promise<readonly TechnicalCheckDefinitionEntity[]> {
    return this.definitions.list(filter);
  }

  async update(
    id: string,
    projectId: string,
    patch: UpdateTechnicalCheckDefinitionDto,
    actorUserId: string,
  ): Promise<TechnicalCheckDefinitionEntity> {
    await this.findById(id, projectId);

    const updated = await this.definitions.update(id, { ...patch, updatedBy: actorUserId });
    if (!updated) {
      throw new NotFoundException(`Technical check definition not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId,
      entityType: "technical_check_definition",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }
}
