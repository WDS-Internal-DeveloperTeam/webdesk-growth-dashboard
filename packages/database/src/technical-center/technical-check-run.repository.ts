import { literal } from "sequelize";
import { getTechnicalCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { TechnicalCheckRunEntity, TechnicalCheckRunStatus } from "./entities.js";

type TechnicalCheckRunContentFields = Omit<
  TechnicalCheckRunEntity,
  "id" | "status" | "startedAt" | "completedAt" | "createdAt" | "updatedAt"
>;

export interface TechnicalCheckRunListFilter {
  readonly projectId: string;
  readonly technicalCheckDefinitionId?: string;
  readonly status?: TechnicalCheckRunStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateTechnicalCheckRunStatusResult =
  | { readonly outcome: "updated"; readonly entity: TechnicalCheckRunEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: TechnicalCheckRunEntity };

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** Every status a run may terminate on — `completedAt` is stamped once the run reaches ANY of
 *  these, not just `completed`, since each is a genuine end of the run's own lifecycle. Mirrors
 *  `scan-center/scan-run.repository.ts`'s own `TERMINAL_STATUSES` exactly. */
const TERMINAL_STATUSES: ReadonlySet<TechnicalCheckRunStatus> = new Set([
  "completed",
  "partially_completed",
  "failed",
  "timed_out",
  "cancelled",
]);

export class TechnicalCheckRunRepository {
  private readonly model = getTechnicalCenterModels().TechnicalCheckRun;

  async create(
    input: Partial<TechnicalCheckRunContentFields> &
      Pick<
        TechnicalCheckRunContentFields,
        "projectId" | "publicId" | "technicalCheckDefinitionId" | "triggerType"
      >,
  ): Promise<TechnicalCheckRunEntity> {
    const instance = await this.model.create({
      projectId: input.projectId,
      publicId: input.publicId,
      technicalCheckDefinitionId: input.technicalCheckDefinitionId,
      status: "requested",
      triggerType: input.triggerType,
      errorSummary: input.errorSummary ?? null,
      requestedBy: input.requestedBy ?? null,
    });
    return toEntityWithIsoDates<TechnicalCheckRunEntity>(instance);
  }

  async findById(id: string): Promise<TechnicalCheckRunEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<TechnicalCheckRunEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<TechnicalCheckRunEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<TechnicalCheckRunEntity>(instance) : null;
  }

  async list(filter: TechnicalCheckRunListFilter): Promise<readonly TechnicalCheckRunEntity[]> {
    const where: Record<string, unknown> = { projectId: filter.projectId };
    if (filter.technicalCheckDefinitionId) {
      where.technicalCheckDefinitionId = filter.technicalCheckDefinitionId;
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
    return rows.map((row) => toEntityWithIsoDates<TechnicalCheckRunEntity>(row));
  }

  /**
   * Atomic compare-and-swap on `(id, status)`, mirroring `ScanRunRepository.updateStatus()`'s own
   * conditional-`UPDATE` pattern exactly. Also conditionally stamps `startedAt` (when
   * `nextStatus === "running"`) and `completedAt` (when `nextStatus` is any terminal status), each
   * via a `COALESCE(column, NOW())` SQL literal baked into the same atomic `UPDATE` — "stamp once,
   * never overwrite" stays atomic with the CAS guard itself.
   */
  async updateStatus(
    id: string,
    expectedCurrentStatus: TechnicalCheckRunStatus,
    nextStatus: TechnicalCheckRunStatus,
    errorSummary?: string | null,
  ): Promise<UpdateTechnicalCheckRunStatusResult> {
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
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<TechnicalCheckRunEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<TechnicalCheckRunEntity>(current) };
  }
}
