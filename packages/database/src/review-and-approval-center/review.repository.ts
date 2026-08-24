import { Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getReviewAndApprovalCenterModels } from "./models.js";
import { toReviewEntity } from "./entity-mapping.js";
import type { ReviewEntity, ReviewStatus } from "./entities.js";

/** `approved`/`rejected` are both terminal (task package D2) — no code path resurrects a review
 *  from either. Shared by `updatePaused()`'s/`updateAssignee()`'s own CAS `WHERE` guards. */
const TERMINAL_STATUSES: readonly ReviewStatus[] = ["approved", "rejected"];

export interface CreateReviewInput {
  readonly targetModuleKey: string;
  readonly targetId: string;
  readonly targetLabel?: string | null;
  readonly submittedByUserId: string;
  readonly assignedToUserId?: string | null;
  readonly versionALabel?: string | null;
  readonly versionBLabel?: string | null;
}

export interface ReviewListFilter {
  readonly status?: ReviewStatus;
  readonly targetModuleKey?: string;
  /** Resolved by the service layer from `?assignedToMe=true` + the caller's own user id (task
   *  package §4/RBAC matrix's own "(assigned)" object-level-scoping requirement) — this repository
   *  itself has no notion of "me". */
  readonly assignedToUserId?: string;
  /** Escaped `ILIKE` on `targetLabel` (`escapeLikePattern()`, `UserRepository`'s own already-
   *  exported helper) — a free-text snapshot, unlike `targetModuleKey`'s closed vocabulary. */
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateReviewStatusResult =
  | { readonly outcome: "updated"; readonly entity: ReviewEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: ReviewEntity };

export type UpdateReviewPausedResult =
  | { readonly outcome: "updated"; readonly entity: ReviewEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: ReviewEntity };

export type UpdateReviewAssigneeResult =
  | { readonly outcome: "updated"; readonly entity: ReviewEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: ReviewEntity };

// Mirrors ContentTemplateRepository's/PersonaRepository's own DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT
// clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** No `projectId` scoping anywhere here — this module's records are organization-wide (task
 *  package D7). No `update()` for content fields — reviews have no editable content beyond what
 *  `decide()`/`setPaused()`/`delegate()`/`create()` already cover (task package D9, no hard delete
 *  either — these are the only mutation paths). */
export class ReviewRepository {
  private readonly model = getReviewAndApprovalCenterModels().Review;

  async create(input: CreateReviewInput): Promise<ReviewEntity> {
    const instance = await this.model.create({
      targetModuleKey: input.targetModuleKey,
      targetId: input.targetId,
      targetLabel: input.targetLabel ?? null,
      status: "submitted",
      isPaused: false,
      submittedByUserId: input.submittedByUserId,
      assignedToUserId: input.assignedToUserId ?? null,
      decidedByUserId: null,
      decidedAt: null,
      versionALabel: input.versionALabel ?? null,
      versionBLabel: input.versionBLabel ?? null,
    });
    return toReviewEntity(instance);
  }

  async findById(id: string): Promise<ReviewEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toReviewEntity(instance) : null;
  }

  async list(filter: ReviewListFilter = {}): Promise<readonly ReviewEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.targetModuleKey) {
      // Exact match, not a fuzzy/ILIKE search — module keys are a closed, known vocabulary
      // (validated against the real module registry at the service layer, task package D6), not
      // free text a user might mistype and want fuzzy-matched.
      where.targetModuleKey = filter.targetModuleKey;
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
    return rows.map((row) => toReviewEntity(row));
  }

  /**
   * Atomic compare-and-swap on `(id, status)` — mirrors `ContentTemplateRepository.updateApprovalStatus()`'s/
   * `PersonaRepository.updateStatus()`'s own conditional-`UPDATE` pattern exactly (itself mirroring
   * `IdempotencyKeyRepository.reserve()`). `decidedByUserId`/`decidedAt` are set unconditionally on
   * every successful call — unlike a "stamp once" field, they always record the MOST RECENT
   * decision (this migration's own doc comment).
   */
  async updateStatus(
    id: string,
    expectedStatus: ReviewStatus,
    nextStatus: ReviewStatus,
    decidedByUserId: string,
    decidedAt: Date,
  ): Promise<UpdateReviewStatusResult> {
    const [affectedCount, affectedRows] = await this.model.update(
      { status: nextStatus, decidedByUserId, decidedAt },
      { where: { id, status: expectedStatus }, returning: true },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return { outcome: "updated", entity: toReviewEntity(affectedRows[0]) };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toReviewEntity(current) };
  }

  /**
   * Atomic compare-and-swap on `(id, isPaused)`, additionally guarding that `status` is not
   * terminal — a paused/resumed review whose status concurrently became `approved`/`rejected`
   * surfaces as a clean conflict rather than a silent pause-after-decision.
   */
  async updatePaused(
    id: string,
    expectedIsPaused: boolean,
    nextIsPaused: boolean,
  ): Promise<UpdateReviewPausedResult> {
    const [affectedCount, affectedRows] = await this.model.update(
      { isPaused: nextIsPaused },
      {
        where: { id, isPaused: expectedIsPaused, status: { [Op.notIn]: TERMINAL_STATUSES } },
        returning: true,
      },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return { outcome: "updated", entity: toReviewEntity(affectedRows[0]) };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toReviewEntity(current) };
  }

  /**
   * Reassigns `assignedToUserId`, guarding that `status` is not terminal — a delegation racing a
   * concurrent decision surfaces as a clean conflict rather than a silent reassignment on an
   * already-decided review.
   */
  async updateAssignee(
    id: string,
    nextAssignedToUserId: string,
  ): Promise<UpdateReviewAssigneeResult> {
    const [affectedCount, affectedRows] = await this.model.update(
      { assignedToUserId: nextAssignedToUserId },
      { where: { id, status: { [Op.notIn]: TERMINAL_STATUSES } }, returning: true },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return { outcome: "updated", entity: toReviewEntity(affectedRows[0]) };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toReviewEntity(current) };
  }
}
