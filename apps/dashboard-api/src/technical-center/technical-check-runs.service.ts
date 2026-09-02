import { randomUUID } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  TechnicalCheckRunEntity,
  TechnicalCheckRunListFilter,
  TechnicalCheckRunRepository,
  TechnicalCheckRunStatus,
  TechnicalFindingRepository,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import {
  TECHNICAL_CENTER_MODULE_KEY,
  TECHNICAL_CHECK_RUN_REPOSITORY,
  TECHNICAL_FINDING_REPOSITORY,
} from "./technical-center.constants.js";
import type {
  ChangeTechnicalCheckRunStatusDto,
  CreateTechnicalCheckRunDto,
} from "./technical-center.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
import { unwrapCasResult } from "../common/cas-result.util.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { TechnicalCheckDefinitionsService } from "./technical-check-definitions.service.js";

/**
 * A run's real lifecycle, mirroring Scan Center's own `ScanRunStatus` workflow byte-for-byte:
 * `requested -> queued -> running ->` one of five terminal outcomes
 * (`completed`/`partially_completed`/`failed`/`timed_out`/`cancelled`), plus direct-to-`cancelled`
 * shortcuts from `requested`/`queued`/`running`. Every terminal state has no outbound transition.
 * Every transition requires the same `edit` action — this codebase's own `development_code` RBAC
 * group has no natural third gate to split submit/review/approve across for THIS particular
 * workflow (`technical-center.constants.ts`'s own doc comment).
 */
const TRANSITIONS: Readonly<Record<TechnicalCheckRunStatus, ReadonlySet<TechnicalCheckRunStatus>>> =
  {
    requested: new Set(["queued", "cancelled"]),
    queued: new Set(["running", "cancelled"]),
    running: new Set(["completed", "partially_completed", "failed", "timed_out", "cancelled"]),
    completed: new Set(),
    partially_completed: new Set(),
    failed: new Set(),
    timed_out: new Set(),
    cancelled: new Set(),
  };

/** The two statuses a run may carry real findings alongside its own transition into. */
const TERMINAL_WITH_FINDINGS: ReadonlySet<TechnicalCheckRunStatus> = new Set([
  "completed",
  "partially_completed",
]);

@Injectable()
export class TechnicalCheckRunsService {
  constructor(
    @Inject(TECHNICAL_CHECK_RUN_REPOSITORY) private readonly runs: TechnicalCheckRunRepository,
    @Inject(TECHNICAL_FINDING_REPOSITORY) private readonly findings: TechnicalFindingRepository,
    private readonly definitions: TechnicalCheckDefinitionsService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    projectId: string,
    input: CreateTechnicalCheckRunDto,
    actorUserId: string,
  ): Promise<TechnicalCheckRunEntity> {
    const definition = await this.definitions.findById(input.technicalCheckDefinitionId, projectId);
    if (!definition.isEnabled) {
      throw new BadRequestException(
        `Technical check definition ${input.technicalCheckDefinitionId} is disabled and cannot be run`,
      );
    }

    let created: TechnicalCheckRunEntity;
    try {
      created = await this.runs.create({
        projectId,
        publicId: input.publicId,
        technicalCheckDefinitionId: input.technicalCheckDefinitionId,
        triggerType: input.triggerType,
        requestedBy: actorUserId,
      });
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
      entityType: "technical_check_run",
      entityId: created.id,
      action: "create",
      afterState: {
        technicalCheckDefinitionId: created.technicalCheckDefinitionId,
        triggerType: created.triggerType,
      },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  /** `projectId`-scoped (IDOR prevention). */
  async findById(id: string, projectId: string): Promise<TechnicalCheckRunEntity> {
    const run = await this.runs.findById(id);
    if (!run || run.projectId !== projectId) {
      throw new NotFoundException(`Technical check run not found: ${id}`);
    }
    return run;
  }

  async list(filter: TechnicalCheckRunListFilter): Promise<readonly TechnicalCheckRunEntity[]> {
    return this.runs.list(filter);
  }

  async changeStatus(
    id: string,
    projectId: string,
    body: ChangeTechnicalCheckRunStatusDto,
    actorUserId: string,
  ): Promise<TechnicalCheckRunEntity> {
    const run = await this.findById(id, projectId);
    const nextStatus = body.status;

    if (run.status === nextStatus) {
      // Mirrors ScanRunsService.changeStatus()'s own accepted, tracked-debt same-status no-op —
      // no state mutation, no data beyond what GET already permits under the same grant.
      return run;
    }

    if (!TRANSITIONS[run.status].has(nextStatus)) {
      throw new BadRequestException(
        `Invalid technical check run status transition: ${run.status} -> ${nextStatus}`,
      );
    }

    // `findings` is only accepted alongside a transition into completed/partially_completed —
    // rejected outright (a clean 400, not silently ignored) on any other target status.
    if (body.findings && body.findings.length > 0 && !TERMINAL_WITH_FINDINGS.has(nextStatus)) {
      throw new BadRequestException(
        `findings may only be supplied when transitioning to completed or partially_completed (got: ${nextStatus})`,
      );
    }

    await this.authorizationService.assertAllowed(
      actorUserId,
      TECHNICAL_CENTER_MODULE_KEY,
      "edit",
      run.projectId,
    );

    // `body.errorSummary` must be passed through AS-IS, not `?? undefined` — the repository's
    // `updateStatus()` deliberately distinguishes `undefined` (leave the column untouched) from
    // `null` (clear it) from a string (set it), mirroring `ScanRunsService.changeStatus()`'s own
    // fixed bug class exactly.
    const result = await this.runs.updateStatus(id, run.status, nextStatus, body.errorSummary);
    const updatedRun = unwrapCasResult(
      result,
      () => `Technical check run not found: ${id}`,
      (entity) =>
        `Technical check run ${id} status changed concurrently (expected ${run.status}, now ${entity.status}) — reload and retry`,
    );

    // Findings are created after the run's own status write has committed — sequential, not one
    // SQL transaction with it, mirroring ScanRunsService.changeStatus()'s own accepted precedent
    // for audit-write-after-commit ordering. Inserted via TechnicalFindingRepository.bulkCreate()
    // — ONE statement, not a per-row loop — so up to 500 findings
    // (technicalCheckRunFindingInputSchema's own .max(500)) commit atomically.
    if (body.findings && body.findings.length > 0) {
      try {
        await this.findings.bulkCreate(
          body.findings.map((finding) => ({
            projectId: run.projectId,
            // A finding has no natural caller-supplied identifier (there is no standalone create
            // route for technical_findings) — a fresh UUID-based publicId.
            publicId: `TCF-${randomUUID()}`,
            technicalCheckRunId: id,
            category: finding.category,
            severity: finding.severity,
            title: finding.title,
            description: finding.description,
            location: finding.location,
          })),
        );
      } catch (error) {
        console.error(
          `Technical check run ${id} transitioned to ${nextStatus}, but creating its ${body.findings.length} finding(s) failed:`,
          error,
        );
      }
    }

    try {
      await this.auditService.record({
        eventType: "data_change",
        actorUserId,
        actorType: "human",
        projectId: run.projectId,
        entityType: "technical_check_run",
        entityId: id,
        action: `status:${run.status}->${nextStatus}`,
        beforeState: { status: run.status },
        afterState: { status: nextStatus },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(
        `Technical check run ${id} status transition ${run.status}->${nextStatus} committed, but recording its audit event failed:`,
        error,
      );
    }

    return updatedRun;
  }
}
