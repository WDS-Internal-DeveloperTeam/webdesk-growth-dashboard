import type {
  ReviewCommentEntity,
  ReviewCommentRepository,
  ReviewEntity,
  ReviewRepository,
} from "@webdesk/database";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import { ReviewCommentsService } from "./review-comments.service.js";

const NOW = new Date("2026-08-24T00:00:00.000Z");

function review(overrides: Partial<ReviewEntity> = {}): ReviewEntity {
  return {
    id: "review-1",
    targetModuleKey: "business_knowledge",
    targetId: "target-1",
    targetLabel: null,
    status: "submitted",
    isPaused: false,
    submittedByUserId: "submitter-1",
    assignedToUserId: null,
    decidedByUserId: null,
    decidedAt: null,
    versionALabel: null,
    versionBLabel: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

function comment(overrides: Partial<ReviewCommentEntity> = {}): ReviewCommentEntity {
  return {
    id: "comment-1",
    reviewId: "review-1",
    authorUserId: "actor-1",
    body: "Looks good so far",
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ReviewCommentsService", () => {
  let comments: { create: ReturnType<typeof vi.fn>; listByReview: ReturnType<typeof vi.fn> };
  let reviews: { findById: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: ReviewCommentsService;

  beforeEach(() => {
    comments = { create: vi.fn(), listByReview: vi.fn() };
    reviews = { findById: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new ReviewCommentsService(
      comments as unknown as ReviewCommentRepository,
      reviews as unknown as ReviewRepository,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a comment after confirming the parent review exists", async () => {
      reviews.findById.mockResolvedValue(review());
      comments.create.mockResolvedValue(comment());

      const result = await svc.create("review-1", { body: "Looks good so far" }, "actor-1");

      expect(result).toEqual(comment());
      expect(comments.create).toHaveBeenCalledWith({
        reviewId: "review-1",
        authorUserId: "actor-1",
        body: "Looks good so far",
      });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "review_comment" }),
      );
    });

    it("throws NotFoundException for a nonexistent review — a clean 404, not a raw FK-violation 500", async () => {
      reviews.findById.mockResolvedValue(null);

      await expect(
        svc.create("no-such-review", { body: "Orphan comment" }, "actor-1"),
      ).rejects.toThrow(NotFoundException);
      expect(comments.create).not.toHaveBeenCalled();
    });

    it("sanitizes body before writing, stripping a disallowed tag (dashboard-web rich-text editor rollout)", async () => {
      reviews.findById.mockResolvedValue(review());
      comments.create.mockResolvedValue(comment());

      await svc.create(
        "review-1",
        { body: "<script>alert(1)</script><p>Looks good so far</p>" },
        "actor-1",
      );

      expect(comments.create).toHaveBeenCalledWith({
        reviewId: "review-1",
        authorUserId: "actor-1",
        body: "<p>Looks good so far</p>",
      });
    });

    it("rejects with 400 a non-empty body that sanitizes down to nothing (code-review finding)", async () => {
      reviews.findById.mockResolvedValue(review());

      await expect(
        svc.create("review-1", { body: "<script>alert(1)</script>" }, "actor-1"),
      ).rejects.toThrow(BadRequestException);
      expect(comments.create).not.toHaveBeenCalled();
    });
  });

  describe("listByReview", () => {
    it("lists comments after confirming the parent review exists", async () => {
      reviews.findById.mockResolvedValue(review());
      comments.listByReview.mockResolvedValue([comment()]);

      const result = await svc.listByReview("review-1");

      expect(result).toEqual([comment()]);
    });

    it("throws NotFoundException for a nonexistent review, rather than a silent empty array", async () => {
      reviews.findById.mockResolvedValue(null);

      await expect(svc.listByReview("no-such-review")).rejects.toThrow(NotFoundException);
      expect(comments.listByReview).not.toHaveBeenCalled();
    });
  });
});
