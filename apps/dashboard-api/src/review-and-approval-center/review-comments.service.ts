import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ReviewCommentEntity,
  ReviewCommentRepository,
  ReviewRepository,
} from "@webdesk/database";
import { sanitizeRichTextHtml } from "@webdesk/validation";
import {
  REVIEW_COMMENT_REPOSITORY,
  REVIEW_REPOSITORY,
} from "./review-and-approval-center.constants.js";
import type { CreateReviewCommentDto } from "./review-and-approval-center.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";

/**
 * A plain comment thread scoped to a parent review — mirrors `ClaimSourcesService`'s own shape
 * (`apps/dashboard-api/src/proof-and-claims-library/claim-sources.service.ts`), the closest
 * existing precedent for a genuine sub-resource service in this codebase. Comments aren't
 * independently governed by the parent review's `status`/`is_paused` — adding one is a `review`-
 * level action (task package D10), checked at the controller/route level, no dynamic
 * per-transition check needed here.
 */
@Injectable()
export class ReviewCommentsService {
  constructor(
    @Inject(REVIEW_COMMENT_REPOSITORY) private readonly comments: ReviewCommentRepository,
    @Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository,
    private readonly auditService: AuditService,
  ) {}

  /** `review_comments.review_id` is FK-constrained (migration `00066`), but a well-formed,
   *  nonexistent `reviewId` would otherwise only be caught at the database layer — surfacing as a
   *  raw, unhandled 500 instead of a clean 404 (mirrors `ClaimSourcesService.create()`'s own
   *  identical guard). Extracted into `assertReviewExists()` (code-review finding) — `create()`
   *  never reads any field off the fetched review, so it's a pure existence check, same as
   *  `listByReview()`'s own identical guard below. */
  private async assertReviewExists(reviewId: string): Promise<void> {
    const review = await this.reviews.findById(reviewId);
    if (!review) {
      throw new NotFoundException(`Review not found: ${reviewId}`);
    }
  }

  async create(
    reviewId: string,
    input: CreateReviewCommentDto,
    actorUserId: string,
  ): Promise<ReviewCommentEntity> {
    await this.assertReviewExists(reviewId);

    // `body` is now real HTML from dashboard-web's RichTextEditor (the dashboard-web UI build,
    // 2026-08-24/25 — per the 2026-08-22 standing rule) — sanitized server-side before storage,
    // mirroring PersonasService.create()'s/ClaimsService.create()'s own identical wiring. `body` is
    // required and never null (createReviewCommentSchema's own `z.string().min(1)`), so it uses
    // `sanitizeRichTextHtml()` directly rather than the nullable-contract wrapper other modules'
    // optional rich-text fields use.
    //
    // The `.min(1)` Zod validated on the RAW input, but `sanitizeRichTextHtml()`'s
    // `disallowedTagsMode: "discard"` strips a `nonTextTags` element (e.g. `<script>...</script>`)
    // along with its own text content — a caller could otherwise submit a non-empty body that
    // sanitizes down to `""`, silently violating the "real comment" contract with no error (a
    // real, reachable gap for any caller hitting this route directly, bypassing the UI's own
    // client-side `isEmptyRichTextHtml()` guard — code-review finding). Checked AFTER
    // sanitization, since that's the only point the true stored value is known.
    const sanitizedBody = sanitizeRichTextHtml(input.body);
    if (sanitizedBody.trim().length === 0) {
      throw new BadRequestException("Comment body must not be empty after sanitization.");
    }

    const created = await this.comments.create({
      reviewId,
      authorUserId: actorUserId,
      body: sanitizedBody,
    });

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "review_comment",
      entityId: created.id,
      action: "create",
      afterState: { reviewId },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  /** Same well-formed-but-nonexistent-`reviewId` guard as `create()` — a list against a genuinely
   *  missing review should read as a clean 404, not a silent empty array indistinguishable from a
   *  real review with zero comments. */
  async listByReview(reviewId: string): Promise<readonly ReviewCommentEntity[]> {
    await this.assertReviewExists(reviewId);
    return this.comments.listByReview(reviewId);
  }
}
