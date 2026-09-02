import { literal } from "sequelize";
import { getScanCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ScanRunEntity, ScanRunStatus } from "./entities.js";

type ScanRunContentFields = Omit<
  ScanRunEntity,
  "id" | "status" | "startedAt" | "completedAt" | "createdAt" | "updatedAt"
>;

export interface ScanRunListFilter {
  readonly projectId: string;
  readonly scanDefinitionId?: string;
  readonly status?: ScanRunStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateScanRunStatusResult =
  | { readonly outcome: "updated"; readonly entity: ScanRunEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: ScanRunEntity };

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** Every status a run may terminate on — `completedAt` is stamped once the run reaches ANY of
 *  these, not just `completed`, since each is a genuine end of the run's own lifecycle. */
const TERMINAL_STATUSES: ReadonlySet<ScanRunStatus> = new Set([
  "completed",
  "partially_completed",
  "failed",
  "timed_out",
  "cancelled",
]);

export class ScanRunRepository {
  private readonly model = getScanCenterModels().ScanRun;

  async create(
    input: Partial<ScanRunContentFields> &
      Pick<ScanRunContentFields, "projectId" | "publicId" | "scanDefinitionId" | "triggerType">,
  ): Promise<ScanRunEntity> {
    const instance = await this.model.create({
      projectId: input.projectId,
      publicId: input.publicId,
      scanDefinitionId: input.scanDefinitionId,
      status: "requested",
      triggerType: input.triggerType,
      errorSummary: input.errorSummary ?? null,
      requestedBy: input.requestedBy ?? null,
    });
    return toEntityWithIsoDates<ScanRunEntity>(instance);
  }

  async findById(id: string): Promise<ScanRunEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<ScanRunEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<ScanRunEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<ScanRunEntity>(instance) : null;
  }

  async list(filter: ScanRunListFilter): Promise<readonly ScanRunEntity[]> {
    const where: Record<string, unknown> = { projectId: filter.projectId };
    if (filter.scanDefinitionId) {
      where.scanDefinitionId = filter.scanDefinitionId;
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
    return rows.map((row) => toEntityWithIsoDates<ScanRunEntity>(row));
  }

  /**
   * Atomic compare-and-swap on `(id, status)`, mirroring `InternalLinkRepository.updateStatus()`'s
   * own conditional-`UPDATE` pattern exactly. Also conditionally stamps `startedAt` (when
   * `nextStatus === "running"`) and `completedAt` (when `nextStatus` is any terminal status), each
   * via a `COALESCE(column, NOW())` SQL literal baked into the same atomic `UPDATE` — "stamp once,
   * never overwrite" stays atomic with the CAS guard itself, same reasoning as
   * `InternalLinkRepository.updateStatus()`'s own `implementedAt`/`verifiedAt` handling.
   */
  async updateStatus(
    id: string,
    expectedCurrentStatus: ScanRunStatus,
    nextStatus: ScanRunStatus,
    errorSummary?: string | null,
  ): Promise<UpdateScanRunStatusResult> {
    const values: Record<string, unknown> = { status: nextStatus };
    if (errorSummary !== undefined) {
      values.errorSummary = errorSummary;
    }
    if (nextStatus === "running") {
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
      return { outcome: "updated", entity: toEntityWithIsoDates<ScanRunEntity>(affectedRows[0]) };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<ScanRunEntity>(current) };
  }
}
