import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ImportErrorRepository,
  ImportRowRepository,
  ImportRunEntity,
  ImportRunListFilter,
  ImportRunRepository,
  ImportRunStatus,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import {
  IMPORT_ERROR_REPOSITORY,
  IMPORT_ROW_REPOSITORY,
  IMPORT_RUN_REPOSITORY,
  IMPORTS_MODULE_KEY,
} from "./import-and-export-center.constants.js";
import type {
  ChangeImportRunStatusDto,
  CreateImportRunDto,
} from "./import-and-export-center.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
import { unwrapCasResult } from "../common/cas-result.util.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ImportTemplatesService } from "./import-templates.service.js";

/** The real, seeded RBAC action required for a given `status` transition — sourced directly from
 *  the `imports` group's own real V/C/E/S/R/A/X letter set (`import-and-export-center.constants.ts`'s
 *  own doc comment): a real two-tier submit/review/approve gate BEFORE any mechanical validation/
 *  execution, then a uniform `edit` for every mechanical step (mirrors Service Library's/Persona
 *  Library's/Website Strategy Center's own dynamic-per-transition-action pattern, not Scan
 *  Center's uniform-`edit`-only shape — this RBAC group has the richer letter set to split on).
 *  `{completed, partially_completed} -> rolled_back` is gated on `approve` — a rollback decision
 *  is significant enough to require the same tier that approves the import itself. */
const TRANSITIONS: Readonly<
  Record<
    ImportRunStatus,
    Readonly<Partial<Record<ImportRunStatus, "submit" | "review" | "approve" | "edit">>>
  >
> = {
  draft: { submitted: "submit", cancelled: "edit" },
  submitted: { rejected: "review", approved: "approve", cancelled: "edit" },
  approved: { validating: "edit", cancelled: "edit" },
  validating: {
    dry_run_completed: "edit",
    importing: "edit",
    failed: "edit",
    cancelled: "edit",
  },
  dry_run_completed: { importing: "edit" },
  importing: { completed: "edit", partially_completed: "edit", failed: "edit", cancelled: "edit" },
  completed: { rolled_back: "approve" },
  partially_completed: { rolled_back: "approve" },
  failed: {},
  cancelled: {},
  rejected: {},
  rolled_back: {},
};

/** The two statuses a run may carry a real `rows`/`runErrors` payload alongside its own
 *  transition into — mirrors `ScanRunsService`'s own `TERMINAL_WITH_FINDINGS` set. */
const STATUSES_ACCEPTING_ROWS: ReadonlySet<ImportRunStatus> = new Set([
  "dry_run_completed",
  "importing",
]);

/** No `projectId` scoping anywhere here — this module's records are organization-wide. */
@Injectable()
export class ImportRunsService {
  constructor(
    @Inject(IMPORT_RUN_REPOSITORY) private readonly runs: ImportRunRepository,
    @Inject(IMPORT_ROW_REPOSITORY) private readonly rows: ImportRowRepository,
    @Inject(IMPORT_ERROR_REPOSITORY) private readonly errors: ImportErrorRepository,
    private readonly templates: ImportTemplatesService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateImportRunDto, actorUserId: string): Promise<ImportRunEntity> {
    const template = await this.templates.findById(input.importTemplateId);
    if (!template.isActive) {
      throw new BadRequestException(
        `Import template ${input.importTemplateId} is disabled and cannot be run`,
      );
    }

    let created: ImportRunEntity;
    try {
      created = await this.runs.create({
        publicId: input.publicId,
        importTemplateId: input.importTemplateId,
        // A snapshot, NOT a live join — records what version the run actually validated against
        // (this migration's own doc comment).
        templateVersion: template.version,
        isDryRun: input.isDryRun,
        duplicateStrategy: input.duplicateStrategy,
        sourceFileReference: input.sourceFileReference,
        sourceChecksum: input.sourceChecksum,
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
        eventType: "import_run",
        actorUserId,
        actorType: "human",
        entityType: "import_run",
        entityId: created.id,
        action: "create",
        afterState: { importTemplateId: created.importTemplateId, isDryRun: created.isDryRun },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(
        `Import run ${created.id} created, but recording its audit event failed:`,
        error,
      );
    }

    return created;
  }

  async findById(id: string): Promise<ImportRunEntity> {
    const run = await this.runs.findById(id);
    if (!run) {
      throw new NotFoundException(`Import run not found: ${id}`);
    }
    return run;
  }

  async list(filter: ImportRunListFilter = {}): Promise<readonly ImportRunEntity[]> {
    return this.runs.list(filter);
  }

  async changeStatus(
    id: string,
    body: ChangeImportRunStatusDto,
    actorUserId: string,
  ): Promise<ImportRunEntity> {
    const run = await this.findById(id);
    const nextStatus = body.status;

    // Mirrors ChangeRecordsService.changeStatus()'s/InternalLinksService.changeStatus()'s own
    // byte-identical, already-accepted same-status no-op — no state mutation, no data beyond what
    // GET already permits under the same grant.
    if (run.status === nextStatus) {
      return run;
    }

    const requiredAction = TRANSITIONS[run.status][nextStatus];
    if (!requiredAction) {
      throw new BadRequestException(
        `Invalid import run status transition: ${run.status} -> ${nextStatus}`,
      );
    }

    // validating -> dry_run_completed is only legal for a run that was actually requested as a
    // dry run, and validating -> importing only for one that wasn't — the workflow doc's own
    // explicit constraint, checked as a clean 400 rather than silently accepted either way.
    if (run.status === "validating" && nextStatus === "dry_run_completed" && !run.isDryRun) {
      throw new BadRequestException(
        `Import run ${id} is not a dry run — cannot transition to dry_run_completed`,
      );
    }
    if (run.status === "validating" && nextStatus === "importing" && run.isDryRun) {
      // Promoting a dry run into a real import happens via dry_run_completed -> importing, not
      // directly from validating.
      throw new BadRequestException(
        `Import run ${id} is a dry run — validating -> importing requires transitioning through dry_run_completed first`,
      );
    }

    // rollbackNotes is only ever meaningful on a transition INTO rolled_back — rejected outright
    // rather than silently ignored, mirroring ChangeRecordsService's own rollbackGuidance-only-
    // on-apply_failed precedent.
    if (body.rollbackNotes !== undefined && nextStatus !== "rolled_back") {
      throw new BadRequestException(
        `rollbackNotes may only be supplied when transitioning to rolled_back (got: ${nextStatus})`,
      );
    }

    // rows/runErrors are only accepted alongside a transition into dry_run_completed/importing —
    // rejected outright on any other target status, mirroring ScanRunsService's own "findings with
    // the wrong target status" precedent.
    const hasRowsPayload =
      (body.rows && body.rows.length > 0) || (body.runErrors && body.runErrors.length > 0);
    if (hasRowsPayload && !STATUSES_ACCEPTING_ROWS.has(nextStatus)) {
      throw new BadRequestException(
        `rows/runErrors may only be supplied when transitioning to dry_run_completed or importing (got: ${nextStatus})`,
      );
    }

    await this.authorizationService.assertAllowed(actorUserId, IMPORTS_MODULE_KEY, requiredAction);

    const result = await this.runs.updateStatus(id, run.status, nextStatus, {
      errorSummary: body.errorSummary,
      rollbackNotes: body.rollbackNotes,
    });
    let updatedRun = unwrapCasResult(
      result,
      () => `Import run not found: ${id}`,
      (entity) =>
        `Import run ${id} status changed concurrently (expected ${run.status}, now ${entity.status}) — reload and retry`,
    );

    // Rows/errors are created after the run's own status write has committed — sequential, not
    // one SQL transaction with it, matching this codebase's own accepted precedent for audit-
    // write-after-commit ordering. Inserted via bulkCreate() — ONE statement per table, not a
    // per-row loop — so the whole batch commits atomically or not at all. A failure here is
    // logged clearly, not silently dropped, but does not fail the transition itself — the run's
    // own status change already committed and is not rolled back on a secondary side effect,
    // mirroring ScanRunsService.changeStatus()'s own identical reasoning.
    if (body.rows && body.rows.length > 0) {
      // One try/catch covering the row (and paired row-error) insert AND the row-count recompute
      // that depends on it — a failed insert means there is nothing new to recompute counts from,
      // so the recompute deliberately does not run on that path (unlike a run-independent
      // secondary side effect, it would just re-derive the same stale counts at the cost of an
      // extra query). Best-effort throughout: logged, not rethrown — the run's own status change
      // already committed and is not rolled back on a secondary side effect, mirroring
      // ScanRunsService.changeStatus()'s own identical reasoning.
      try {
        // bulkCreate() returns the created rows in the same order as the input array (Sequelize's
        // own documented `bulkCreate` contract, backed here by Postgres's implicit RETURNING) — used
        // below, by index, to link a row-specific error back to the row's own real database id, not
        // just its caller-supplied rowNumber.
        const createdRows = await this.rows.bulkCreate(
          body.rows.map((row) => ({
            importRunId: id,
            rowNumber: row.rowNumber,
            externalId: row.externalId,
            rawData: row.rawData,
            status: row.status,
            resolution: row.resolution,
          })),
        );

        const rowErrorInputs = body.rows
          .map((row, index) => ({ row, createdRow: createdRows[index] }))
          .filter(({ row }) => row.errorMessage)
          .map(({ row, createdRow }) => ({
            importRunId: id,
            importRowId: createdRow?.id ?? null,
            message: row.errorMessage!,
            errorCode: row.errorCode,
            fieldName: row.fieldName,
          }));
        if (rowErrorInputs.length > 0) {
          await this.errors.bulkCreate(rowErrorInputs);
        }

        // Recompute total_rows/success_count/error_count/skipped_count from the real,
        // just-inserted rows — never trusted from caller input (this migration's own doc
        // comment).
        const counts = await this.runs.countByStatus(id);
        await this.runs.applyRowCounts(id, counts);
        const refreshed = await this.runs.findById(id);
        if (refreshed) {
          updatedRun = refreshed;
        }
      } catch (error) {
        console.error(
          `Import run ${id} transitioned to ${nextStatus}, but creating its ${body.rows.length} row(s) (or recomputing its counts) failed:`,
          error,
        );
      }
    }

    if (body.runErrors && body.runErrors.length > 0) {
      try {
        await this.errors.bulkCreate(
          body.runErrors.map((runError) => ({
            importRunId: id,
            importRowId: null,
            message: runError.message,
            errorCode: runError.errorCode,
            fieldName: runError.fieldName,
          })),
        );
      } catch (error) {
        console.error(
          `Import run ${id} transitioned to ${nextStatus}, but creating its ${body.runErrors.length} run-level error(s) failed:`,
          error,
        );
      }
    }

    const isApprovalLike = requiredAction === "approve";
    try {
      await this.auditService.record({
        eventType: "import_run",
        actorUserId,
        actorType: "human",
        entityType: "import_run",
        entityId: id,
        action: `status:${run.status}->${nextStatus}`,
        beforeState: { status: run.status },
        afterState: { status: nextStatus },
        retentionCategory: isApprovalLike ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Import run ${id} status transition ${run.status}->${nextStatus} committed, but recording its audit event failed:`,
        error,
      );
    }

    return updatedRun;
  }
}
