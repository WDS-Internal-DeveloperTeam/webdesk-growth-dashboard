import { literal, Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getTechnicalCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type {
  TechnicalFindingEntity,
  TechnicalFindingSeverity,
  TechnicalFindingStatus,
} from "./entities.js";

type TechnicalFindingContentFields = Omit<
  TechnicalFindingEntity,
  "id" | "status" | "resolvedBy" | "resolvedAt" | "createdAt" | "updatedAt"
>;

export interface TechnicalFindingListFilter {
  readonly projectId: string;
  readonly technicalCheckRunId?: string;
  readonly severity?: TechnicalFindingSeverity;
  readonly status?: TechnicalFindingStatus;
  /** Fuzzy match on `title` (uses the `pg_trgm` index). */
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateTechnicalFindingStatusResult =
  | { readonly outcome: "updated"; readonly entity: TechnicalFindingEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: TechnicalFindingEntity };

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export class TechnicalFindingRepository {
  private readonly model = getTechnicalCenterModels().TechnicalFinding;

  /** Used internally by `TechnicalCheckRunsService` when a run transitions to a terminal-with-
   *  findings state — there is no standalone `POST` route for this table. */
  async create(
    input: Partial<TechnicalFindingContentFields> &
      Pick<
        TechnicalFindingContentFields,
        "projectId" | "publicId" | "technicalCheckRunId" | "severity" | "title"
      >,
  ): Promise<TechnicalFindingEntity> {
    const instance = await this.model.create({
      projectId: input.projectId,
      publicId: input.publicId,
      technicalCheckRunId: input.technicalCheckRunId,
      category: input.category ?? null,
      severity: input.severity,
      title: input.title,
      description: input.description ?? null,
      location: input.location ?? null,
      status: "open",
    });
    return toEntityWithIsoDates<TechnicalFindingEntity>(instance);
  }

  /** Inserts every row in one statement, atomically — used by `TechnicalCheckRunsService.
   *  changeStatus()` when a run transitions into `completed`/`partially_completed` with a real
   *  findings payload (up to 500 rows per `technicalCheckRunFindingInputSchema`'s own `.max(500)`).
   *  Mirrors `ScanFindingRepository.bulkCreate()` exactly — a mid-batch failure never leaves a
   *  silently-partial set persisted; the statement either fails (and inserts nothing) or succeeds
   *  as one unit. */
  async bulkCreate(
    inputs: readonly (Partial<TechnicalFindingContentFields> &
      Pick<
        TechnicalFindingContentFields,
        "projectId" | "publicId" | "technicalCheckRunId" | "severity" | "title"
      >)[],
  ): Promise<readonly TechnicalFindingEntity[]> {
    if (inputs.length === 0) {
      return [];
    }
    const instances = await this.model.bulkCreate(
      inputs.map((input) => ({
        projectId: input.projectId,
        publicId: input.publicId,
        technicalCheckRunId: input.technicalCheckRunId,
        category: input.category ?? null,
        severity: input.severity,
        title: input.title,
        description: input.description ?? null,
        location: input.location ?? null,
        status: "open",
      })),
    );
    return instances.map((instance) => toEntityWithIsoDates<TechnicalFindingEntity>(instance));
  }

  async findById(id: string): Promise<TechnicalFindingEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<TechnicalFindingEntity>(instance) : null;
  }

  async list(filter: TechnicalFindingListFilter): Promise<readonly TechnicalFindingEntity[]> {
    const where: Record<string, unknown> = { projectId: filter.projectId };
    if (filter.technicalCheckRunId) {
      where.technicalCheckRunId = filter.technicalCheckRunId;
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
    return rows.map((row) => toEntityWithIsoDates<TechnicalFindingEntity>(row));
  }

  /** Atomic compare-and-swap on `(id, status)`, mirroring `ScanFindingRepository.updateStatus()`'s
   *  own pattern exactly. Conditionally stamps `resolvedAt`/`resolvedBy` when `nextStatus` is
   *  either terminal disposition (`resolved` OR `dismissed`), via a `COALESCE(resolved_at, NOW())`
   *  literal so the timestamp is never reset once first set. `resolvedBy` is a plain unconditional
   *  assignment on that same branch — safe because both `resolved`/`dismissed` are fully terminal
   *  in `TechnicalFindingsService`'s own `TRANSITIONS` table (no outbound edge from either), so
   *  this write can only ever happen once per row. */
  async updateStatus(
    id: string,
    expectedCurrentStatus: TechnicalFindingStatus,
    nextStatus: TechnicalFindingStatus,
    resolvedBy: string | null,
  ): Promise<UpdateTechnicalFindingStatusResult> {
    const values: Record<string, unknown> = { status: nextStatus };
    if (nextStatus === "resolved" || nextStatus === "dismissed") {
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
        entity: toEntityWithIsoDates<TechnicalFindingEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return {
      outcome: "conflict",
      entity: toEntityWithIsoDates<TechnicalFindingEntity>(current),
    };
  }
}
