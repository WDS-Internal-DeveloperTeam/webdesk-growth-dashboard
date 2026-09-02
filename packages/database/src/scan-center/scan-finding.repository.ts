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

  /** Inserts every row in one statement, atomically — used by `ScanRunsService.changeStatus()`
   *  when a run transitions into `completed`/`partially_completed` with a real findings payload
   *  (up to 500 rows per `scanRunFindingInputSchema`'s own `.max(500)`). Replaces a one-row-at-a-
   *  time loop that was both up to 500 sequential round-trips AND non-atomic — a mid-batch failure
   *  used to leave however many rows had already committed silently persisted while the rest were
   *  lost, with only a server-side log line; `bulkCreate()` fails (and inserts nothing) or succeeds
   *  as one unit. */
  async bulkCreate(
    inputs: readonly (Partial<ScanFindingContentFields> &
      Pick<
        ScanFindingContentFields,
        "projectId" | "publicId" | "scanRunId" | "severity" | "title"
      >)[],
  ): Promise<readonly ScanFindingEntity[]> {
    if (inputs.length === 0) {
      return [];
    }
    const instances = await this.model.bulkCreate(
      inputs.map((input) => ({
        projectId: input.projectId,
        publicId: input.publicId,
        scanRunId: input.scanRunId,
        category: input.category ?? null,
        severity: input.severity,
        title: input.title,
        description: input.description ?? null,
        location: input.location ?? null,
        status: "open",
      })),
    );
    return instances.map((instance) => toEntityWithIsoDates<ScanFindingEntity>(instance));
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
   *  pattern. Conditionally stamps `resolvedAt`/`resolvedBy` when `nextStatus` is either terminal
   *  disposition (`resolved` OR `dismissed`) — both are "someone closed this finding" outcomes
   *  (`ScanFindingsService.changeStatus()` passes `actorUserId` for both), via a
   *  `COALESCE(resolved_at, NOW())` literal so the timestamp is never reset once first set.
   *  `resolvedBy` is a plain unconditional assignment on that same branch — safe because both
   *  `resolved`/`dismissed` are fully terminal in `ScanFindingsService`'s own `TRANSITIONS` table
   *  (no outbound edge from either), so this write can only ever happen once per row. */
  async updateStatus(
    id: string,
    expectedCurrentStatus: ScanFindingStatus,
    nextStatus: ScanFindingStatus,
    resolvedBy: string | null,
  ): Promise<UpdateScanFindingStatusResult> {
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
