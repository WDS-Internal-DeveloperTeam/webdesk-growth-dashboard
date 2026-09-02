import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ScanDefinitionEntity,
  ScanDefinitionListFilter,
  ScanDefinitionRepository,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import { SCAN_DEFINITION_REPOSITORY } from "./scan-center.constants.js";
import type { CreateScanDefinitionDto, UpdateScanDefinitionDto } from "./scan-center.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ProjectService } from "../projects/project.service.js";

@Injectable()
export class ScanDefinitionsService {
  constructor(
    @Inject(SCAN_DEFINITION_REPOSITORY) private readonly definitions: ScanDefinitionRepository,
    private readonly projects: ProjectService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    projectId: string,
    input: CreateScanDefinitionDto,
    actorUserId: string,
  ): Promise<ScanDefinitionEntity> {
    const [, existing] = await Promise.all([
      this.projects.findById(projectId),
      this.definitions.findByPublicId(input.publicId),
    ]);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: ScanDefinitionEntity;
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
      entityType: "scan_definition",
      entityId: created.id,
      action: "create",
      afterState: { name: created.name, scanType: created.scanType },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  /** `projectId`-scoped (IDOR prevention) — a definition from a different project, accessed via
   *  this project's own route, is treated as not found rather than silently returned/mutated. */
  async findById(id: string, projectId: string): Promise<ScanDefinitionEntity> {
    const definition = await this.definitions.findById(id);
    if (!definition || definition.projectId !== projectId) {
      throw new NotFoundException(`Scan definition not found: ${id}`);
    }
    return definition;
  }

  async list(filter: ScanDefinitionListFilter): Promise<readonly ScanDefinitionEntity[]> {
    return this.definitions.list(filter);
  }

  async update(
    id: string,
    projectId: string,
    patch: UpdateScanDefinitionDto,
    actorUserId: string,
  ): Promise<ScanDefinitionEntity> {
    await this.findById(id, projectId);

    const updated = await this.definitions.update(id, { ...patch, updatedBy: actorUserId });
    if (!updated) {
      throw new NotFoundException(`Scan definition not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId,
      entityType: "scan_definition",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }
}
