import { Op, type Transaction, type WhereOptions } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getDesignReviewCenterModels } from "./models.js";
import { toDesignReviewEntity } from "./entity-mapping.js";
import type { DesignReviewEntity, DesignReviewStatus, DesignReviewType } from "./entities.js";

/** `approved`/`rejected`/`superseded` are all terminal (D3) — no code path resurrects a review
 *  from any of the three. Shared by `updateStatus()`'s own CAS `WHERE` guard. */
const TERMINAL_STATUSES: readonly DesignReviewStatus[] = ["approved", "rejected", "superseded"];

export interface CreateDesignReviewInput {
  readonly targetModuleKey: string;
  readonly targetId: string;
  readonly targetLabel?: string | null;
  readonly reviewType: DesignReviewType;
  readonly submittedByUserId: string;
  readonly assignedToUserId?: string | null;
  readonly versionALabel?: string | null;
  readonly versionBLabel?: string | null;
}

export interface DesignReviewListFilter {
  readonly status?: DesignReviewStatus;
  readonly targetModuleKey?: string;
  readonly reviewType?: DesignReviewType;
  /** Resolved by the service layer from `?assignedToMe=true` + the caller's own user id (mirrors
   *  `ReviewRepository`'s own precedent) — this repository itself has no notion of "me". */
  readonly assignedToUserId?: string;
  /** Escaped `ILIKE` on `targetLabel` (`escapeLikePattern()`, `UserRepository`'s own already-
   *  exported helper) — a free-text snapshot, unlike `targetModuleKey`'s/`reviewType`'s closed
   *  vocabularies. */
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type DesignReviewCasResult<T> =
  | { readonly outcome: "updated"; readonly entity: T }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: T };

// Mirrors ReviewRepository's/ContentTemplateRepository's own DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT
// clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** No `projectId` scoping anywhere here — this module's records are organization-wide (D8). No
 *  `update()` for content fields — reviews have no editable content beyond what `decide()`/
 *  `create()` already cover (D10, no hard delete either — these are the only mutation paths). */
export class DesignReviewRepository {
  private readonly model = getDesignReviewCenterModels().DesignReview;

  async create(input: CreateDesignReviewInput): Promise<DesignReviewEntity> {
    const instance = await this.model.create({
      targetModuleKey: input.targetModuleKey,
      targetId: input.targetId,
      targetLabel: input.targetLabel ?? null,
      reviewType: input.reviewType,
      status: "submitted",
      submittedByUserId: input.submittedByUserId,
      assignedToUserId: input.assignedToUserId ?? null,
      decidedByUserId: null,
      decidedAt: null,
      versionALabel: input.versionALabel ?? null,
      versionBLabel: input.versionBLabel ?? null,
    });
    return toDesignReviewEntity(instance);
  }

  async findById(id: string, transaction?: Transaction): Promise<DesignReviewEntity | null> {
    const instance = await this.model.findByPk(id, { transaction });
    return instance ? toDesignReviewEntity(instance) : null;
  }

  async list(filter: DesignReviewListFilter = {}): Promise<readonly DesignReviewEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.targetModuleKey) {
      // Exact match, not a fuzzy/ILIKE search — module keys are a closed, known vocabulary
      // (validated against the real module registry at the service layer, D9), not free text a
      // user might mistype and want fuzzy-matched.
      where.targetModuleKey = filter.targetModuleKey;
    }
    if (filter.reviewType) {
      where.reviewType = filter.reviewType;
    }
    if (filter.assignedToUserId) {
      where.assignedToUserId = filter.assignedToUserId;
    }
    if (filter.search) {
      where.targetLabel = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two
      // separate paginated queries, matching every sibling module's own established precedent.
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toDesignReviewEntity(row));
  }

  /**
   * Shared CAS-outcome resolver, mirroring `ReviewRepository.casUpdate()`'s own already-reviewed
   * pattern. Runs `model.update(changes, {where, returning: true, transaction})`; on a zero-row
   * match, a second read distinguishes "no such id" from "id exists but didn't match the CAS
   * guard" for the caller's own conflict message.
   */
  private async casUpdate(
    id: string,
    where: WhereOptions,
    changes: Record<string, unknown>,
    transaction?: Transaction,
  ): Promise<DesignReviewCasResult<DesignReviewEntity>> {
    const [affectedCount, affectedRows] = await this.model.update(changes, {
      where,
      returning: true,
      transaction,
    });
    if (affectedCount > 0 && affectedRows[0]) {
      return { outcome: "updated", entity: toDesignReviewEntity(affectedRows[0]) };
    }
    const current = await this.model.findOne({ where: { id }, transaction });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toDesignReviewEntity(current) };
  }

  /**
   * Atomic compare-and-swap on `(id, status)` — mirrors `ReviewRepository.updateStatus()`'s own
   * conditional-`UPDATE` pattern exactly (itself mirroring `IdempotencyKeyRepository.reserve()`).
   * `decidedByUserId`/`decidedAt` are set unconditionally on every successful call — unlike a
   * "stamp once" field, they always record the MOST RECENT decision.
   *
   * `expectedStatus` is rejected up front when it's itself one of `TERMINAL_STATUSES` — without
   * this, a caller who observed a review as `approved`/`rejected`/`superseded` and replays that
   * value as `expectedStatus` would have their CAS `WHERE {id, status: expectedStatus}` match the
   * row exactly, silently reversing a supposedly-permanent decision. This is checked before ever
   * issuing the `UPDATE`, not encoded as an additional `WHERE` clause, since ANDing
   * `status: expectedStatus` with `status: notIn(TERMINAL_STATUSES)` would be self-contradictory
   * the moment `expectedStatus` itself is terminal.
   */
  async updateStatus(
    id: string,
    expectedStatus: DesignReviewStatus,
    nextStatus: DesignReviewStatus,
    decidedByUserId: string,
    decidedAt: Date,
    transaction?: Transaction,
  ): Promise<DesignReviewCasResult<DesignReviewEntity>> {
    if (TERMINAL_STATUSES.includes(expectedStatus)) {
      const current = await this.model.findOne({ where: { id }, transaction });
      if (!current) {
        return { outcome: "not_found" };
      }
      return { outcome: "conflict", entity: toDesignReviewEntity(current) };
    }
    return this.casUpdate(
      id,
      { id, status: expectedStatus },
      { status: nextStatus, decidedByUserId, decidedAt },
      transaction,
    );
  }

  /**
   * Locks every row matching `(targetModuleKey, targetId, reviewType)` — including the row about
   * to be approved — via `SELECT ... FOR UPDATE`, before the CAS status update runs. Without this
   * (code-review finding), two concurrent `decide(approve)` calls on two DIFFERENT pre-existing
   * reviews sharing the same tuple could each commit `status = "approved"` without ever seeing the
   * other's not-yet-committed write under Postgres's default READ COMMITTED isolation — each
   * transaction's own CAS `UPDATE` and `supersedeOtherApproved()` scan only touch rows already
   * committed *before that statement started*, so if neither transaction has committed yet when
   * the other runs its supersede scan, both leave two rows simultaneously `"approved"`, silently
   * violating the "at most one approved review per tuple" invariant `supersedeOtherApproved()`
   * exists to enforce. Acquiring this lock first serializes the two transactions: the second one's
   * lock acquisition blocks until the first commits or rolls back, so by the time it proceeds,
   * its own `supersedeOtherApproved()` call is guaranteed to see the first transaction's
   * already-committed approval. A safe no-op (locks nothing) when no row yet exists for the tuple.
   * Must be called before `updateStatus()`/`supersedeOtherApproved()`, inside the same transaction.
   */
  async lockTupleForApproval(
    targetModuleKey: string,
    targetId: string,
    reviewType: DesignReviewType,
    transaction: Transaction,
  ): Promise<void> {
    await this.model.findAll({
      where: { targetModuleKey, targetId, reviewType },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
  }

  /**
   * D4 — "supersede" is not a distinct user action; it's an automatic consequence of approving a
   * new review for the SAME `(targetModuleKey, targetId, reviewType)` tuple. Flips every OTHER row
   * matching that tuple that currently holds `status = "approved"` to `"superseded"` — mirrors
   * `WebsiteStrategyRecordRepository.supersedeOtherApprovedVersion()`'s own already-reviewed
   * pattern (`UPDATE ... WHERE target_module_key = $1 AND target_id = $2 AND review_type = $3 AND
   * status = 'approved' AND id <> $4`), scoped to this 3-column tuple instead of a single
   * `recordId`. Unlike that method, this one RETURNS the newly-superseded rows (`returning: true`)
   * so the caller (`DesignReviewsService.decide()`) can write a matching
   * `design_review_decisions` row and `audit_events` mirror for each one — there could in
   * principle be more than one, though in steady state there should be at most one. A safe no-op
   * (returns `[]`) when no such row exists (a target's first-ever approval for this reviewType).
   * Always called inside the same transaction as the triggering `updateStatus()` call, so both
   * writes commit or roll back together.
   */
  async supersedeOtherApproved(
    targetModuleKey: string,
    targetId: string,
    reviewType: DesignReviewType,
    excludeId: string,
    transaction: Transaction,
  ): Promise<readonly DesignReviewEntity[]> {
    const [, affectedRows] = await this.model.update(
      { status: "superseded" },
      {
        where: {
          targetModuleKey,
          targetId,
          reviewType,
          status: "approved",
          id: { [Op.ne]: excludeId },
        },
        returning: true,
        transaction,
      },
    );
    return affectedRows.map((row) => toDesignReviewEntity(row));
  }
}
