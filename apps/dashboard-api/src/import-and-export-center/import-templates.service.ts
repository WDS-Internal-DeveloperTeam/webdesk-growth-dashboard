import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ImportTemplateEntity,
  ImportTemplateListFilter,
  ImportTemplateRepository,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import { IMPORT_TEMPLATE_REPOSITORY } from "./import-and-export-center.constants.js";
import type {
  CreateImportTemplateDto,
  UpdateImportTemplateDto,
} from "./import-and-export-center.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";

/** No `projectId` scoping anywhere here — this module's records are organization-wide (D-scope). */
@Injectable()
export class ImportTemplatesService {
  constructor(
    @Inject(IMPORT_TEMPLATE_REPOSITORY) private readonly templates: ImportTemplateRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateImportTemplateDto, actorUserId: string): Promise<ImportTemplateEntity> {
    const isValidTargetModule = await this.authorizationService.isValidModuleKey(
      input.targetModuleKey,
    );
    if (!isValidTargetModule) {
      throw new BadRequestException(
        `targetModuleKey does not resolve to a real module: ${input.targetModuleKey}`,
      );
    }

    let created: ImportTemplateEntity;
    try {
      created = await this.templates.create({
        publicId: input.publicId,
        name: input.name,
        targetModuleKey: input.targetModuleKey,
        columnMapping: input.columnMapping ?? null,
        duplicateStrategyDefault: input.duplicateStrategyDefault,
        fileFormat: input.fileFormat,
        isActive: input.isActive,
        createdBy: actorUserId,
      });
    } catch (error) {
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(`publicId already in use: ${input.publicId}`);
      }
      throw error;
    }

    try {
      await this.auditService.record({
        eventType: "import_run",
        actorUserId,
        actorType: "human",
        entityType: "import_template",
        entityId: created.id,
        action: "create",
        afterState: { targetModuleKey: created.targetModuleKey, fileFormat: created.fileFormat },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(
        `Import template ${created.id} created, but recording its audit event failed:`,
        error,
      );
    }

    return created;
  }

  async findById(id: string): Promise<ImportTemplateEntity> {
    const template = await this.templates.findById(id);
    if (!template) {
      throw new NotFoundException(`Import template not found: ${id}`);
    }
    return template;
  }

  async list(filter: ImportTemplateListFilter = {}): Promise<readonly ImportTemplateEntity[]> {
    return this.templates.list(filter);
  }

  async update(
    id: string,
    patch: UpdateImportTemplateDto,
    actorUserId: string,
  ): Promise<ImportTemplateEntity> {
    await this.findById(id);

    const updated = await this.templates.update(id, { ...patch, updatedBy: actorUserId });
    if (!updated) {
      throw new NotFoundException(`Import template not found: ${id}`);
    }

    try {
      await this.auditService.record({
        eventType: "import_run",
        actorUserId,
        actorType: "human",
        entityType: "import_template",
        entityId: id,
        action: "update",
        afterState: { ...patch },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(`Import template ${id} updated, but recording its audit event failed:`, error);
    }

    return updated;
  }
}
