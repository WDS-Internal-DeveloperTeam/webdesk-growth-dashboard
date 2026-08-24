import { getReviewAndApprovalCenterModels } from "./models.js";
import { toReviewDecisionEntity } from "./entity-mapping.js";
import type { ReviewDecisionAction, ReviewDecisionEntity } from "./entities.js";

export interface CreateReviewDecisionInput {
  readonly reviewId: string;
  readonly action: ReviewDecisionAction;
  readonly actorUserId: string;
  readonly notes?: string | null;
  /** Set only when `action === "delegate"` (task package §3). */
  readonly delegatedToUserId?: string | null;
  /** Defaults to `now()` at the database layer when omitted — a caller that already computed a
   *  single, shared timestamp for both this row and `reviews.decidedAt` (in `ReviewsService.decide()`)
   *  passes it explicitly so both records agree exactly; every other caller (`setPaused()`/
   *  `delegate()`, which don't stamp `reviews.decidedAt`) can omit it. */
  readonly decidedAt?: Date;
}

/** Append-only by application convention (like every other module's audit-adjacent table in this
 *  codebase) — no `update()`/`remove()` method exists here at all. The real immutable legal
 *  record for approval-shaped decisions is the separate, DB-trigger-enforced `audit_events` table
 *  (task package D5); this repository is just the review's own queryable local history. */
export class ReviewDecisionRepository {
  private readonly model = getReviewAndApprovalCenterModels().ReviewDecision;

  async create(input: CreateReviewDecisionInput): Promise<ReviewDecisionEntity> {
    const instance = await this.model.create({
      reviewId: input.reviewId,
      action: input.action,
      actorUserId: input.actorUserId,
      notes: input.notes ?? null,
      delegatedToUserId: input.delegatedToUserId ?? null,
      ...(input.decidedAt ? { decidedAt: input.decidedAt } : {}),
    });
    return toReviewDecisionEntity(instance);
  }

  async listByReview(reviewId: string): Promise<readonly ReviewDecisionEntity[]> {
    const rows = await this.model.findAll({
      where: { reviewId },
      order: [
        ["decidedAt", "DESC"],
        ["id", "ASC"],
      ],
    });
    return rows.map((row) => toReviewDecisionEntity(row));
  }
}
