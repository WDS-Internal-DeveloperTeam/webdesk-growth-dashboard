import { literal, Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getImportAndExportCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ExportRunEntity, ExportRunStatus } from "./entities.js";

type ExportRunContentFields = Omit<
  ExportRunEntity,
  "id" | "status" | "startedAt" | "completedAt" | "createdAt" | "updatedAt"
>;

export interface ExportRunListFilter {
  readonly targetModuleKey?: string;
  readonly status?: ExportRunStatus;
  /** Fuzzy match on `targetModuleKey` — kept for symmetry with every sibling module's own
   *  `search` filter, even though `targetModuleKey` is a closed, module-registry-validated value
   *  in practice (no free-text field exists on this table to search instead). */
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateExportRunStatusResult =
  | { readonly outcome: "updated"; readonly entity: ExportRunEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: ExportRunEntity };

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

const TERMINAL_STATUSES: ReadonlySet<ExportRunStatus> = new Set([
  "completed",
  "failed",
  "cancelled",
]);

/** No `projectId` scoping anywhere here — this module's records are organization-wide. */
export class ExportRunRepository {
  private readonly model = getImportAndExportCenterModels().ExportRun;

  async create(
    input: Partial<ExportRunContentFields> &
      Pick<ExportRunContentFields, "publicId" | "targetModuleKey" | "format">,
  ): Promise<ExportRunEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      targetModuleKey: input.targetModuleKey,
      filterCriteria: input.filterCriteria ?? null,
      format: input.format,
      status: "requested",
      rowCount: input.rowCount ?? null,
      fileReference: input.fileReference ?? null,
      excludesConfidentialFields: true,
      errorSummary: input.errorSummary ?? null,
      requestedBy: input.requestedBy ?? null,
    });
    return toEntityWithIsoDates<ExportRunEntity>(instance);
  }

  async findById(id: string): Promise<ExportRunEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<ExportRunEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<ExportRunEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<ExportRunEntity>(instance) : null;
  }

  async list(filter: ExportRunListFilter = {}): Promise<readonly ExportRunEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.targetModuleKey) {
      where.targetModuleKey = filter.targetModuleKey;
    }
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.search) {
      where.targetModuleKey = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
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
    return rows.map((row) => toEntityWithIsoDates<ExportRunEntity>(row));
  }

  /** Atomic compare-and-swap on `(id, status)`, same shape as `ImportRunRepository.updateStatus()`
   *  narrowed to `export_runs`' own simpler 5-state workflow — `startedAt` stamped when
   *  `nextStatus === "processing"`, `completedAt` stamped on any of `completed`/`failed`/
   *  `cancelled`. */
  async updateStatus(
    id: string,
    expectedCurrentStatus: ExportRunStatus,
    nextStatus: ExportRunStatus,
    extraFields?: {
      errorSummary?: string | null;
      rowCount?: number | null;
      fileReference?: string | null;
    },
  ): Promise<UpdateExportRunStatusResult> {
    const values: Record<string, unknown> = { status: nextStatus };
    if (extraFields?.errorSummary !== undefined) {
      values.errorSummary = extraFields.errorSummary;
    }
    if (extraFields?.rowCount !== undefined) {
      values.rowCount = extraFields.rowCount;
    }
    if (extraFields?.fileReference !== undefined) {
      values.fileReference = extraFields.fileReference;
    }
    if (nextStatus === "processing") {
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
      return { outcome: "updated", entity: toEntityWithIsoDates<ExportRunEntity>(affectedRows[0]) };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<ExportRunEntity>(current) };
  }
}
