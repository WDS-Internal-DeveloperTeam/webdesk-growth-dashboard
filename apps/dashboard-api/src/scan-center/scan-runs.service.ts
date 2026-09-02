import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ScanFindingRepository,
  ScanRunEntity,
  ScanRunListFilter,
  ScanRunRepository,
  ScanRunStatus,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import {
  SCAN_CENTER_MODULE_KEY,
  SCAN_FINDING_REPOSITORY,
  SCAN_RUN_REPOSITORY,
} from "./scan-center.constants.js";
import type { ChangeScanRunStatusDto, CreateScanRunDto } from "./scan-center.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ScanDefinitionsService } from "./scan-definitions.service.js";

/**
 * A run's real lifecycle, sourced from the design scope: `requested -> queued -> running ->` one
 * of five terminal outcomes (`completed`/`partially_completed`/`failed`/`timed_out`/`cancelled`),
 * plus two direct-to-`cancelled` shortcuts from `queued`/`running` (a user can cancel a scan before
 * or during execution, not only after it finishes). Every terminal state has no outbound
 * transition — unlike Internal Linking Library's own 4-state loop, this workflow really does end.
 * Every transition requires the same `edit` action — the seeded `scans` RBAC group has no
 * submit/review/approve letters to split by (`scan-center.constants.ts`'s own doc comment).
 */
const TRANSITIONS: Readonly<Record<ScanRunStatus, ReadonlySet<ScanRunStatus>>> = {
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
const TERMINAL_WITH_FINDINGS: ReadonlySet<ScanRunStatus> = new Set([
  "completed",
  "partially_completed",
]);

@Injectable()
export class ScanRunsService {
  constructor(
    @Inject(SCAN_RUN_REPOSITORY) private readonly runs: ScanRunRepository,
    @Inject(SCAN_FINDING_REPOSITORY) private readonly findings: ScanFindingRepository,
    private readonly definitions: ScanDefinitionsService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    projectId: string,
    input: CreateScanRunDto,
    actorUserId: string,
  ): Promise<ScanRunEntity> {
    const definition = await this.definitions.findById(input.scanDefinitionId, projectId);
    if (!definition.isEnabled) {
      throw new BadRequestException(
        `Scan definition ${input.scanDefinitionId} is disabled and cannot be run`,
      );
    }

    let created: ScanRunEntity;
    try {
      created = await this.runs.create({
        projectId,
        publicId: input.publicId,
        scanDefinitionId: input.scanDefinitionId,
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
      eventType: "scan_run",
      actorUserId,
      actorType: "human",
      projectId: created.projectId,
      entityType: "scan_run",
      entityId: created.id,
      action: "create",
      afterState: { scanDefinitionId: created.scanDefinitionId, triggerType: created.triggerType },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  /** `projectId`-scoped (IDOR prevention). */
  async findById(id: string, projectId: string): Promise<ScanRunEntity> {
    const run = await this.runs.findById(id);
    if (!run || run.projectId !== projectId) {
      throw new NotFoundException(`Scan run not found: ${id}`);
    }
    return run;
  }

  async list(filter: ScanRunListFilter): Promise<readonly ScanRunEntity[]> {
    return this.runs.list(filter);
  }

  async changeStatus(
    id: string,
    projectId: string,
    body: ChangeScanRunStatusDto,
    actorUserId: string,
  ): Promise<ScanRunEntity> {
    const run = await this.findById(id, projectId);
    const nextStatus = body.status;

    if (run.status === nextStatus) {
      // Mirrors InternalLinksService.changeStatus()'s own accepted, tracked-debt same-status
      // no-op — no state mutation, no data beyond what GET already permits under the same grant.
      return run;
    }

    if (!TRANSITIONS[run.status].has(nextStatus)) {
      throw new BadRequestException(
        `Invalid scan run status transition: ${run.status} -> ${nextStatus}`,
      );
    }

    // `findings` is only accepted alongside a transition into completed/partially_completed —
    // rejected outright (a clean 400, not silently ignored) on any other target status, since a
    // caller sending findings for e.g. `failed` almost certainly has a real bug in their own
    // client.
    if (body.findings && body.findings.length > 0 && !TERMINAL_WITH_FINDINGS.has(nextStatus)) {
      throw new BadRequestException(
        `findings may only be supplied when transitioning to completed or partially_completed (got: ${nextStatus})`,
      );
    }

    await this.authorizationService.assertAllowed(
      actorUserId,
      SCAN_CENTER_MODULE_KEY,
      "edit",
      run.projectId,
    );

    const result = await this.runs.updateStatus(
      id,
      run.status,
      nextStatus,
      body.errorSummary ?? undefined,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Scan run not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Scan run ${id} status changed concurrently (expected ${run.status}, now ${result.entity.status}) — reload and retry`,
      );
    }

    // Findings are created after the run's own status write has committed — sequential, not one
    // SQL transaction with it, matching this codebase's own accepted precedent for audit-write-
    // after-commit ordering (InternalLinksService.changeStatus()'s own audit call). A failure here
    // is logged clearly, not silently dropped, since it means real scan output never made it into
    // the database even though the run itself is marked done.
    if (body.findings && body.findings.length > 0) {
      try {
        for (const finding of body.findings) {
          await this.findings.create({
            projectId: run.projectId,
            // A finding has no natural caller-supplied identifier (there is no standalone create
            // route for scan_findings) — a fresh UUID-based publicId, always well within the
            // 64-char column limit regardless of the parent run's own publicId length.
            publicId: `FND-${randomUUID()}`,
            scanRunId: id,
            category: finding.category,
            severity: finding.severity,
            title: finding.title,
            description: finding.description,
            location: finding.location,
          });
        }
      } catch (error) {
        console.error(
          `Scan run ${id} transitioned to ${nextStatus}, but creating its ${body.findings.length} finding(s) failed:`,
          error,
        );
      }
    }

    try {
      await this.auditService.record({
        eventType: "scan_run",
        actorUserId,
        actorType: "human",
        projectId: run.projectId,
        entityType: "scan_run",
        entityId: id,
        action: `status:${run.status}->${nextStatus}`,
        beforeState: { status: run.status },
        afterState: { status: nextStatus },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(
        `Scan run ${id} status transition ${run.status}->${nextStatus} committed, but recording its audit event failed:`,
        error,
      );
    }

    return result.entity;
  }
}
