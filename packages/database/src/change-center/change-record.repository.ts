import { col, fn, literal, Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getChangeCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type {
  ChangeRecordEntity,
  ChangeRecordCategory,
  ChangeRecordSeverity,
  ChangeRecordStatus,
} from "./entities.js";

/** Every field a caller may set/change on create — `ChangeRecordEntity` minus its server-only-
 *  managed columns, derived rather than hand-retyped, mirroring `InternalLinkContentFields`'s own
 *  precedent. */
type ChangeRecordContentFields = Omit<
  ChangeRecordEntity,
  | "id"
  | "status"
  | "decidedByUserId"
  | "decidedAt"
  | "appliedByUserId"
  | "appliedAt"
  | "verifiedByUserId"
  | "verifiedAt"
  | "rollbackGuidance"
  | "createdAt"
  | "updatedAt"
>;

/** `update()`'s patch shape — every content field optional; `publicId`/`projectId`/`category` are
 *  excluded (all immutable after create), mirroring `KeywordUpdateFields`'s/
 *  `InternalLinkUpdateFields`'s own precedent. `status`/the decision-and-apply-tail timestamps/
 *  `rollbackGuidance` are never accepted here — only `updateStatus()` may change any of them. */
type ChangeRecordUpdateFields = Omit<
  ChangeRecordContentFields,
  "publicId" | "projectId" | "category"
>;

export interface ChangeRecordListFilter {
  /** Required — change records are project-scoped; there is no cross-project "list every change"
   *  concept in this module. */
  readonly projectId: string;
  readonly category?: ChangeRecordCategory;
  readonly severity?: ChangeRecordSeverity;
  readonly status?: ChangeRecordStatus;
  readonly scanFindingId?: string;
  readonly assignedToUserId?: string;
  /** Fuzzy match on `recordLabel` (uses the `pg_trgm` index). */
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateChangeRecordStatusResult =
  | { readonly outcome: "updated"; readonly entity: ChangeRecordEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: ChangeRecordEntity };

// Mirrors KeywordRepository's/InternalLinkRepository's own DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT
// clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** Statuses that represent a real human decision — `decidedByUserId`/`decidedAt` are (re-)stamped
 *  with the current actor/time every time a record transitions into any one of these (see
 *  `updateStatus()`'s own doc comment for why this is a plain overwrite, not a `COALESCE`). */
const DECISION_STATUSES: ReadonlySet<ChangeRecordStatus> = new Set([
  "accepted",
  "rejected",
  "deferred",
  "manual_merge_required",
]);

export class ChangeRecordRepository {
  private readonly model = getChangeCenterModels().ChangeRecord;

  async create(
    input: Partial<ChangeRecordContentFields> &
      Pick<
        ChangeRecordContentFields,
        "projectId" | "publicId" | "category" | "severity" | "recordLabel"
      >,
  ): Promise<ChangeRecordEntity> {
    const instance = await this.model.create({
      projectId: input.projectId,
      publicId: input.publicId,
      category: input.category,
      severity: input.severity,
      status: "detected",
      scanFindingId: input.scanFindingId ?? null,
      source: input.source ?? null,
      targetModuleKey: input.targetModuleKey ?? null,
      targetId: input.targetId ?? null,
      recordLabel: input.recordLabel,
      beforeValue: input.beforeValue ?? null,
      afterValue: input.afterValue ?? null,
      confidence: input.confidence ?? null,
      recommendation: input.recommendation ?? null,
      assignedToUserId: input.assignedToUserId ?? null,
      decisionNotes: input.decisionNotes ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<ChangeRecordEntity>(instance);
  }

  async findById(id: string): Promise<ChangeRecordEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<ChangeRecordEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<ChangeRecordEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<ChangeRecordEntity>(instance) : null;
  }

  async list(filter: ChangeRecordListFilter): Promise<readonly ChangeRecordEntity[]> {
    const where: Record<string, unknown> = { projectId: filter.projectId };
    if (filter.category) {
      where.category = filter.category;
    }
    if (filter.severity) {
      where.severity = filter.severity;
    }
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.scanFindingId) {
      where.scanFindingId = filter.scanFindingId;
    }
    if (filter.assignedToUserId) {
      where.assignedToUserId = filter.assignedToUserId;
    }
    if (filter.search) {
      where.recordLabel = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
    }

    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two separate
      // paginated queries, matching every sibling module's own precedent.
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<ChangeRecordEntity>(row));
  }

  /**
   * Content update — `status` and every server-managed timestamp/`rollbackGuidance` are
   * deliberately never accepted here; only `updateStatus()` may change any of them. A single
   * atomic `UPDATE ... RETURNING`, not a separate `findOne()` + `instance.update()`.
   * `expectedStatus` is an optional CAS guard — mirrors `InternalLinkRepository.update()`'s own
   * `expectedStatus` parameter: without it, a concurrent `updateStatus()` transition landing
   * between the service's `findById()` read and this write could let an in-place edit silently
   * succeed against a status the caller never actually saw.
   */
  async update(
    id: string,
    patch: Partial<ChangeRecordUpdateFields>,
    expectedStatus?: ChangeRecordStatus,
  ): Promise<ChangeRecordEntity | null> {
    const where: Record<string, unknown> = { id };
    if (expectedStatus) {
      where.status = expectedStatus;
    }
    const [affectedCount, affectedRows] = await this.model.update(patch, {
      where,
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<ChangeRecordEntity>(affectedRows[0]);
  }

  /**
   * Atomic compare-and-swap on `(id, status)`, mirroring `InternalLinkRepository.updateStatus()`'s/
   * `ScanRunRepository.updateStatus()`'s own conditional-`UPDATE` pattern exactly. Also stamps
   * `decidedByUserId`/`decidedAt` (when `nextStatus` is one of the four real decision states),
   * `appliedByUserId`/`appliedAt` (when `nextStatus === "applied"`), and `verifiedByUserId`/
   * `verifiedAt` (when `nextStatus === "verified"`), all in the same atomic `UPDATE` as the CAS
   * write.
   *
   * True "stamp once, never overwrite" semantics, matching `InternalLinkRepository.updateStatus()`'s/
   * `ScanRunRepository.updateStatus()`'s own `COALESCE(column, NOW())` precedent — including for
   * the actor-id half of each pair, via `Sequelize.fn("COALESCE", Sequelize.col(...), actorUserId)`
   * rather than `literal()`: `fn()`'s own arguments are bound as real, parameterized query values
   * (identical trust level to `values.status = nextStatus` a few lines below), never string-built
   * into raw SQL, so `actorUserId` never needs to be interpolated. A record re-entering the same
   * milestone (`apply_failed -> applying -> applied` after a retry, `deferred -> under_review ->
   * accepted` after a re-decision) keeps the ORIGINAL decision/apply/verify actor and time —
   * matching `ChangeRecordEntity`'s own documented contract for these six columns, not silently
   * overwriting it with the latest retry's actor.
   *
   * `rollbackGuidance`/`decisionNotes` are only written when the caller explicitly passes them
   * (`!== undefined`) — the service layer is responsible for only ever passing `rollbackGuidance`
   * alongside a transition into `apply_failed` (validated at the DTO layer); this method itself
   * stays a dumb, generic CAS write with no status-specific field-gating logic of its own.
   */
  async updateStatus(
    id: string,
    expectedCurrentStatus: ChangeRecordStatus,
    nextStatus: ChangeRecordStatus,
    actorUserId: string,
    options: {
      readonly rollbackGuidance?: string | null;
      readonly decisionNotes?: string | null;
    } = {},
  ): Promise<UpdateChangeRecordStatusResult> {
    const values: Record<string, unknown> = { status: nextStatus, updatedBy: actorUserId };
    if (options.rollbackGuidance !== undefined) {
      values.rollbackGuidance = options.rollbackGuidance;
    } else if (expectedCurrentStatus === "apply_failed" && nextStatus !== "apply_failed") {
      // Leaving apply_failed for any other status (a retry) without a fresh rollbackGuidance
      // value clears the stale one out — otherwise it would describe a failure the record has
      // since recovered from, forever, with no other way to reset it (the status-change DTO
      // rejects any rollbackGuidance paired with a non-apply_failed target status).
      values.rollbackGuidance = null;
    }
    if (options.decisionNotes !== undefined) {
      values.decisionNotes = options.decisionNotes;
    }
    if (DECISION_STATUSES.has(nextStatus)) {
      values.decidedByUserId = fn("COALESCE", col("decided_by_user_id"), actorUserId);
      values.decidedAt = literal('COALESCE("decided_at", NOW())');
    }
    if (nextStatus === "applied") {
      values.appliedByUserId = fn("COALESCE", col("applied_by_user_id"), actorUserId);
      values.appliedAt = literal('COALESCE("applied_at", NOW())');
    }
    if (nextStatus === "verified") {
      values.verifiedByUserId = fn("COALESCE", col("verified_by_user_id"), actorUserId);
      values.verifiedAt = literal('COALESCE("verified_at", NOW())');
    }

    const [affectedCount, affectedRows] = await this.model.update(values, {
      where: { id, status: expectedCurrentStatus },
      returning: true,
    });
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<ChangeRecordEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<ChangeRecordEntity>(current) };
  }
}
