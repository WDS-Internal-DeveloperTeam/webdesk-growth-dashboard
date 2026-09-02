import { literal } from "sequelize";
import { getImportAndExportCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ImportRowStatus } from "./entities.js";
import type { ImportRunEntity, ImportRunStatus } from "./entities.js";

type ImportRunContentFields = Omit<
  ImportRunEntity,
  | "id"
  | "status"
  | "totalRows"
  | "successCount"
  | "errorCount"
  | "skippedCount"
  | "startedAt"
  | "completedAt"
  | "createdAt"
  | "updatedAt"
>;

export interface ImportRunListFilter {
  readonly importTemplateId?: string;
  readonly status?: ImportRunStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateImportRunStatusResult =
  | { readonly outcome: "updated"; readonly entity: ImportRunEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: ImportRunEntity };

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** Every status a run may terminate on — `completedAt` is stamped once the run reaches ANY of
 *  these, not just `completed`, since each is a genuine end of the run's own lifecycle (mirrors
 *  `ScanRunRepository`'s own `TERMINAL_STATUSES` set). */
const TERMINAL_STATUSES: ReadonlySet<ImportRunStatus> = new Set([
  "completed",
  "partially_completed",
  "failed",
  "cancelled",
  "rejected",
  "rolled_back",
]);

/**
 * Maps an `import_rows.status` value onto which of `import_runs`' own four counter columns it
 * contributes to (`ImportRunsService`'s own row-count-recompute pass, documented once here since
 * both `countByStatus()`/`applyRowCounts()` share this exact mapping): `imported` -> success,
 * `invalid`/`failed` -> error, `skipped` -> skipped. `pending`/`valid` rows aren't yet a terminal
 * outcome, so they contribute to `totalRows` only, not to any of the other three counters.
 */
const SUCCESS_STATUSES: ReadonlySet<ImportRowStatus> = new Set(["imported"]);
const ERROR_STATUSES: ReadonlySet<ImportRowStatus> = new Set(["invalid", "failed"]);
const SKIPPED_STATUSES: ReadonlySet<ImportRowStatus> = new Set(["skipped"]);

export type ImportRowCountsByStatus = Readonly<Record<ImportRowStatus, number>>;

const ZERO_ROW_COUNTS: ImportRowCountsByStatus = {
  pending: 0,
  valid: 0,
  invalid: 0,
  imported: 0,
  skipped: 0,
  failed: 0,
};

/** No `projectId` scoping anywhere here — this module's records are organization-wide. */
export class ImportRunRepository {
  private readonly model = getImportAndExportCenterModels().ImportRun;

  async create(
    input: Partial<ImportRunContentFields> &
      Pick<
        ImportRunContentFields,
        "publicId" | "importTemplateId" | "templateVersion" | "isDryRun"
      >,
  ): Promise<ImportRunEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      importTemplateId: input.importTemplateId,
      templateVersion: input.templateVersion,
      isDryRun: input.isDryRun,
      duplicateStrategy: input.duplicateStrategy ?? null,
      sourceFileReference: input.sourceFileReference ?? null,
      sourceChecksum: input.sourceChecksum ?? null,
      status: "draft",
      totalRows: 0,
      successCount: 0,
      errorCount: 0,
      skippedCount: 0,
      errorSummary: input.errorSummary ?? null,
      rollbackNotes: input.rollbackNotes ?? null,
      requestedBy: input.requestedBy ?? null,
    });
    return toEntityWithIsoDates<ImportRunEntity>(instance);
  }

  async findById(id: string): Promise<ImportRunEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<ImportRunEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<ImportRunEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<ImportRunEntity>(instance) : null;
  }

  async list(filter: ImportRunListFilter = {}): Promise<readonly ImportRunEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.importTemplateId) {
      where.importTemplateId = filter.importTemplateId;
    }
    if (filter.status) {
      where.status = filter.status;
    }

    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<ImportRunEntity>(row));
  }

  /**
   * Atomic compare-and-swap on `(id, status)`, mirroring `ScanRunRepository.updateStatus()`'s own
   * conditional-`UPDATE` pattern exactly. Also conditionally stamps `startedAt` (when
   * `nextStatus === "importing"`) and `completedAt` (when `nextStatus` is any terminal status),
   * each via a `COALESCE(column, NOW())` SQL literal baked into the same atomic `UPDATE` — "stamp
   * once, never overwrite" stays atomic with the CAS guard itself.
   */
  async updateStatus(
    id: string,
    expectedCurrentStatus: ImportRunStatus,
    nextStatus: ImportRunStatus,
    extraFields?: { errorSummary?: string | null; rollbackNotes?: string | null },
  ): Promise<UpdateImportRunStatusResult> {
    const values: Record<string, unknown> = { status: nextStatus };
    if (extraFields?.errorSummary !== undefined) {
      values.errorSummary = extraFields.errorSummary;
    }
    if (extraFields?.rollbackNotes !== undefined) {
      values.rollbackNotes = extraFields.rollbackNotes;
    }
    if (nextStatus === "importing") {
      values.startedAt = literal('COALESCE("started_at", NOW())');
    }
    if (TERMINAL_STATUSES.has(nextStatus)) {
      values.completedAt = literal('COALESCE("completed_at", NOW())');
    }

    const [affectedCount, affectedRows] = await this.model.update(values, {
      where: { id, status: expectedCurrentStatus },
      returning: true,
    });
    if (affectedCount > 0 && affectedRows[0]) {
      return { outcome: "updated", entity: toEntityWithIsoDates<ImportRunEntity>(affectedRows[0]) };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<ImportRunEntity>(current) };
  }

  /** A real `GROUP BY status, COUNT(*)` aggregate over `import_rows` for one run (via Sequelize's
   *  own `count({ group })`, not a raw query) — every real `ImportRowStatus` key is always present
   *  in the result, defaulting to `0` when a run has no rows in that status, so
   *  `applyRowCounts()`'s own callers never need to guard a missing key. */
  async countByStatus(importRunId: string): Promise<ImportRowCountsByStatus> {
    const rows = getImportAndExportCenterModels().ImportRow;
    const results = (await rows.count({
      where: { importRunId },
      group: ["status"],
    })) as unknown as { status: ImportRowStatus; count: number }[];

    const counts: Record<ImportRowStatus, number> = { ...ZERO_ROW_COUNTS };
    for (const row of results) {
      counts[row.status] = Number(row.count);
    }
    return counts;
  }

  /**
   * Atomically writes `totalRows`/`successCount`/`errorCount`/`skippedCount` back onto the run
   * row, derived from a real `countByStatus()` result: `totalRows` is the sum of every status
   * count; `successCount` is the `imported` count; `errorCount` is `invalid` + `failed`;
   * `skippedCount` is the `skipped` count. `pending`/`valid` rows contribute to `totalRows` only —
   * they aren't yet a terminal per-row outcome.
   */
  async applyRowCounts(importRunId: string, counts: ImportRowCountsByStatus): Promise<void> {
    const totalRows = Object.values(counts).reduce((sum, count) => sum + count, 0);
    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    for (const [status, count] of Object.entries(counts) as [ImportRowStatus, number][]) {
      if (SUCCESS_STATUSES.has(status)) {
        successCount += count;
      } else if (ERROR_STATUSES.has(status)) {
        errorCount += count;
      } else if (SKIPPED_STATUSES.has(status)) {
        skippedCount += count;
      }
    }

    await this.model.update(
      { totalRows, successCount, errorCount, skippedCount },
      { where: { id: importRunId } },
    );
  }
}
