import { getReviewAndApprovalCenterModels } from "./models.js";
import { toReviewCommentEntity } from "./entity-mapping.js";
import type { ReviewCommentEntity } from "./entities.js";

export interface CreateReviewCommentInput {
  readonly reviewId: string;
  readonly authorUserId: string;
  readonly body: string;
}

export class ReviewCommentRepository {
  private readonly model = getReviewAndApprovalCenterModels().ReviewComment;

  async create(input: CreateReviewCommentInput): Promise<ReviewCommentEntity> {
    const instance = await this.model.create({
      reviewId: input.reviewId,
      authorUserId: input.authorUserId,
      body: input.body,
    });
    return toReviewCommentEntity(instance);
  }

  async listByReview(reviewId: string): Promise<readonly ReviewCommentEntity[]> {
    const rows = await this.model.findAll({
      where: { reviewId },
      // Oldest-first — a comment thread reads top-to-bottom chronologically, unlike a
      // most-recent-first list view.
      order: [
        ["createdAt", "ASC"],
        ["id", "ASC"],
      ],
    });
    return rows.map((row) => toReviewCommentEntity(row));
  }
}
