import { literal, Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getScanCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ScanFindingEntity, ScanFindingSeverity, ScanFindingStatus } from "./entities.js";

type ScanFindingContentFields = Omit<
  ScanFindingEntity,
  "id" | "status" | "resolvedBy" | "resolvedAt" | "createdAt" | "updatedAt"
>;

export interface ScanFindingListFilter {
  readonly projectId: string;
  readonly scanRunId?: string;
  readonly severity?: ScanFindingSeverity;
  readonly status?: ScanFindingStatus;
  /** Fuzzy match on `title` (uses the `pg_trgm` index). */
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateScanFindingStatusResult =
  | { readonly outcome: "updated"; readonly entity: ScanFindingEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: ScanFindingEntity };

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export class ScanFindingRepository {
  private readonly model = getScanCenterModels().ScanFinding;

  /** Used internally by `ScanRunsService` when a run transitions to a terminal-with-findings
   *  state — there is no standalone `POST` route for this table. */
  async create(
    input: Partial<ScanFindingContentFields> &
      Pick<ScanFindingContentFields, "projectId" | "publicId" | "scanRunId" | "severity" | "title">,
  ): Promise<ScanFindingEntity> {
    const instance = await this.model.create({
      projectId: input.projectId,
      publicId: input.publicId,
      scanRunId: input.scanRunId,
      category: input.category ?? null,
      severity: input.severity,
      title: input.title,
      description: input.description ?? null,
      location: input.location ?? null,
      status: "open",
    });
    return toEntityWithIsoDates<ScanFindingEntity>(instance);
  }

  async findById(id: string): Promise<ScanFindingEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<ScanFindingEntity>(instance) : null;
  }

  async list(filter: ScanFindingListFilter): Promise<readonly ScanFindingEntity[]> {
    const where: Record<string, unknown> = { projectId: filter.projectId };
    if (filter.scanRunId) {
      where.scanRunId = filter.scanRunId;
    }
    if (filter.severity) {
      where.severity = filter.severity;
    }
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.search) {
      where.title = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
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
    return rows.map((row) => toEntityWithIsoDates<ScanFindingEntity>(row));
  }

  /** Atomic compare-and-swap on `(id, status)`, mirroring `ScanRunRepository.updateStatus()`'s own
   *  pattern. Conditionally stamps `resolvedAt`/`resolvedBy` when `nextStatus === "resolved"`, via a
   *  `COALESCE(resolved_at, NOW())` literal so a repeat transition back into `resolved` (e.g. via
   *  `dismissed -> resolved`) never resets the original resolution timestamp. */
  async updateStatus(
    id: string,
    expectedCurrentStatus: ScanFindingStatus,
    nextStatus: ScanFindingStatus,
    resolvedBy: string | null,
  ): Promise<UpdateScanFindingStatusResult> {
    const values: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === "resolved") {
      values.resolvedAt = literal('COALESCE("resolved_at", NOW())');
      values.resolvedBy = resolvedBy;
    }

    const [affectedCount, affectedRows] = await this.model.update(values, {
      where: { id, status: expectedCurrentStatus },
      returning: true,
    });
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<ScanFindingEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<ScanFindingEntity>(current) };
  }
}
