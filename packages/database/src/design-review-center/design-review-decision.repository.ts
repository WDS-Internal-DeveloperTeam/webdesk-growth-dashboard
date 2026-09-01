import type { Transaction } from "sequelize";
import { getDesignReviewCenterModels } from "./models.js";
import { toDesignReviewDecisionEntity } from "./entity-mapping.js";
import type { DesignReviewDecisionAction, DesignReviewDecisionEntity } from "./entities.js";

export interface CreateDesignReviewDecisionInput {
  readonly reviewId: string;
  readonly action: DesignReviewDecisionAction;
  readonly actorUserId: string;
  readonly notes?: string | null;
  /** Defaults to `now()` at the database layer when omitted — a caller that already computed a
   *  single, shared timestamp for both this row and `design_reviews.decidedAt` (in
   *  `DesignReviewsService.decide()`) passes it explicitly so both records agree exactly. */
  readonly decidedAt?: Date;
}

/** Append-only by application convention (like every other module's audit-adjacent table in this
 *  codebase) — no `update()`/`remove()` method exists here at all. The real immutable legal
 *  record for approval-shaped decisions is the separate, DB-trigger-enforced `audit_events` table
 *  (D7); this repository is just the review's own queryable local history. */
export class DesignReviewDecisionRepository {
  private readonly model = getDesignReviewCenterModels().DesignReviewDecision;

  /** `transaction`, when supplied, lets a caller (`DesignReviewsService.decide()`) commit this
   *  write atomically alongside the parent `design_reviews` CAS update — mirrors
   *  `ReviewDecisionRepository.create()`'s own already-reviewed rationale (a non-transactional
   *  pair here would leave the review's new state durably persisted with zero record of who
   *  changed it or why on a transient failure). */
  async create(
    input: CreateDesignReviewDecisionInput,
    transaction?: Transaction,
  ): Promise<DesignReviewDecisionEntity> {
    const instance = await this.model.create(
      {
        reviewId: input.reviewId,
        action: input.action,
        actorUserId: input.actorUserId,
        notes: input.notes ?? null,
        ...(input.decidedAt ? { decidedAt: input.decidedAt } : {}),
      },
      { transaction },
    );
    return toDesignReviewDecisionEntity(instance);
  }

  async listByReview(reviewId: string): Promise<readonly DesignReviewDecisionEntity[]> {
    const rows = await this.model.findAll({
      where: { reviewId },
      order: [
        ["decidedAt", "DESC"],
        ["id", "ASC"],
      ],
    });
    return rows.map((row) => toDesignReviewDecisionEntity(row));
  }
}
