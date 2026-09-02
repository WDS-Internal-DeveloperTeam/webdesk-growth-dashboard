import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ExportRunEntity,
  ExportRunListFilter,
  ExportRunRepository,
  ExportRunStatus,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import { EXPORT_RUN_REPOSITORY, EXPORTS_MODULE_KEY } from "./import-and-export-center.constants.js";
import type {
  ChangeExportRunStatusDto,
  CreateExportRunDto,
} from "./import-and-export-center.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
import { unwrapCasResult } from "../common/cas-result.util.js";

/** Simple, no-approval-gate 5-state pipeline (the `exports` RBAC group has no submit/review/
 *  approve letters — `export` itself functions as the create-gate, mirrored here by requiring
 *  `export` for every legal transition, not just the create route). */
const TRANSITIONS: Readonly<Record<ExportRunStatus, ReadonlySet<ExportRunStatus>>> = {
  requested: new Set(["processing", "cancelled"]),
  processing: new Set(["completed", "failed", "cancelled"]),
  completed: new Set(),
  failed: new Set(),
  cancelled: new Set(),
};

/** No `projectId` scoping anywhere here — this module's records are organization-wide. */
@Injectable()
export class ExportRunsService {
  constructor(
    @Inject(EXPORT_RUN_REPOSITORY) private readonly runs: ExportRunRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateExportRunDto, actorUserId: string): Promise<ExportRunEntity> {
    const isValidTargetModule = await this.authorizationService.isValidModuleKey(
      input.targetModuleKey,
    );
    if (!isValidTargetModule) {
      throw new BadRequestException(
        `targetModuleKey does not resolve to a real module: ${input.targetModuleKey}`,
      );
    }

    let created: ExportRunEntity;
    try {
      created = await this.runs.create({
        publicId: input.publicId,
        targetModuleKey: input.targetModuleKey,
        filterCriteria: input.filterCriteria,
        format: input.format,
        requestedBy: actorUserId,
      });
    } catch (error) {
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(`publicId already in use: ${input.publicId}`);
      }
      throw error;
    }

    try {
      await this.auditService.record({
        eventType: "export_run",
        actorUserId,
        actorType: "human",
        entityType: "export_run",
        entityId: created.id,
        action: "create",
        afterState: { targetModuleKey: created.targetModuleKey, format: created.format },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(
        `Export run ${created.id} created, but recording its audit event failed:`,
        error,
      );
    }

    return created;
  }

  async findById(id: string): Promise<ExportRunEntity> {
    const run = await this.runs.findById(id);
    if (!run) {
      throw new NotFoundException(`Export run not found: ${id}`);
    }
    return run;
  }

  async list(filter: ExportRunListFilter = {}): Promise<readonly ExportRunEntity[]> {
    return this.runs.list(filter);
  }

  async changeStatus(
    id: string,
    body: ChangeExportRunStatusDto,
    actorUserId: string,
  ): Promise<ExportRunEntity> {
    const run = await this.findById(id);
    const nextStatus = body.status;

    if (run.status === nextStatus) {
      return run;
    }

    if (!TRANSITIONS[run.status].has(nextStatus)) {
      throw new BadRequestException(
        `Invalid export run status transition: ${run.status} -> ${nextStatus}`,
      );
    }

    await this.authorizationService.assertAllowed(actorUserId, EXPORTS_MODULE_KEY, "export");

    const result = await this.runs.updateStatus(id, run.status, nextStatus, {
      errorSummary: body.errorSummary,
      rowCount: body.rowCount,
      fileReference: body.fileReference,
    });
    const updatedRun = unwrapCasResult(
      result,
      () => `Export run not found: ${id}`,
      (entity) =>
        `Export run ${id} status changed concurrently (expected ${run.status}, now ${entity.status}) — reload and retry`,
    );

    try {
      await this.auditService.record({
        eventType: "export_run",
        actorUserId,
        actorType: "human",
        entityType: "export_run",
        entityId: id,
        action: `status:${run.status}->${nextStatus}`,
        beforeState: { status: run.status },
        afterState: { status: nextStatus },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(
        `Export run ${id} status transition ${run.status}->${nextStatus} committed, but recording its audit event failed:`,
        error,
      );
    }

    return updatedRun;
  }
}
