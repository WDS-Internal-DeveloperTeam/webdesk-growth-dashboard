import type {
  ReviewDecisionEntity,
  ReviewDecisionRepository,
  ReviewEntity,
  ReviewRepository,
} from "@webdesk/database";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../audit/audit.service.js";
import type { AuthorizationService } from "../authz/authorization.service.js";
import type { SeparationOfDutiesService } from "../auth/common/separation-of-duties.service.js";
import type { UsersService } from "../users/users.service.js";
import { ReviewsService } from "./reviews.service.js";

// withTransaction() opens a real Sequelize connection (needs DATABASE_URL) — irrelevant to this
// service's own logic, so it's stubbed to just invoke the callback, matching
// project.service.spec.ts's own established pattern for the identical mocking need.
vi.mock("@webdesk/database", async (importOriginal) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- vitest's importOriginal<T>() needs the actual module's type inline; no top-level type-only equivalent exists for this generic parameter.
  const actual = await importOriginal<typeof import("@webdesk/database")>();
  return {
    ...actual,
    withTransaction: vi.fn((fn: (transaction: unknown) => unknown) =>
      fn({ fakeTransaction: true }),
    ),
  };
});

const FAKE_TRANSACTION = { fakeTransaction: true };
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

function decision(overrides: Partial<ReviewDecisionEntity> = {}): ReviewDecisionEntity {
  return {
    id: "decision-1",
    reviewId: "review-1",
    action: "approve",
    actorUserId: "approver-1",
    notes: null,
    delegatedToUserId: null,
    decidedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("ReviewsService", () => {
  let reviews: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
    updatePaused: ReturnType<typeof vi.fn>;
    updateAssignee: ReturnType<typeof vi.fn>;
  };
  let reviewDecisions: { create: ReturnType<typeof vi.fn>; listByReview: ReturnType<typeof vi.fn> };
  let authorizationService: {
    assertAllowed: ReturnType<typeof vi.fn>;
    isValidModuleKey: ReturnType<typeof vi.fn>;
  };
  let separationOfDuties: { assertDistinctActors: ReturnType<typeof vi.fn> };
  let usersService: { assertUserExists: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: ReviewsService;

  beforeEach(() => {
    reviews = {
      create: vi.fn(),
      findById: vi.fn(),
      list: vi.fn(),
      updateStatus: vi.fn(),
      updatePaused: vi.fn(),
      updateAssignee: vi.fn(),
    };
    reviewDecisions = { create: vi.fn(), listByReview: vi.fn() };
    authorizationService = { assertAllowed: vi.fn(), isValidModuleKey: vi.fn() };
    separationOfDuties = { assertDistinctActors: vi.fn() };
    usersService = { assertUserExists: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new ReviewsService(
      reviews as unknown as ReviewRepository,
      reviewDecisions as unknown as ReviewDecisionRepository,
      authorizationService as unknown as AuthorizationService,
      separationOfDuties as unknown as SeparationOfDutiesService,
      usersService as unknown as UsersService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a review after validating targetModuleKey against the real module registry", async () => {
      authorizationService.isValidModuleKey.mockResolvedValue(true);
      reviews.create.mockResolvedValue(review());

      const result = await svc.create(
        { targetModuleKey: "business_knowledge", targetId: "target-1" },
        "submitter-1",
      );

      expect(result).toEqual(review());
      expect(authorizationService.isValidModuleKey).toHaveBeenCalledWith("business_knowledge");
      expect(reviews.create).toHaveBeenCalledWith(
        expect.objectContaining({ submittedByUserId: "submitter-1" }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "review" }),
      );
    });

    it("rejects an unrecognized targetModuleKey with a clean 400, before ever touching the repository", async () => {
      authorizationService.isValidModuleKey.mockResolvedValue(false);

      await expect(
        svc.create({ targetModuleKey: "no-such-module", targetId: "target-1" }, "submitter-1"),
      ).rejects.toThrow(BadRequestException);
      expect(reviews.create).not.toHaveBeenCalled();
    });

    it("validates a supplied assignedToUserId exists, concurrently with the module-key check (code-review fix)", async () => {
      authorizationService.isValidModuleKey.mockResolvedValue(true);
      usersService.assertUserExists.mockResolvedValue(undefined);
      reviews.create.mockResolvedValue(review({ assignedToUserId: "approver-1" }));

      await svc.create(
        {
          targetModuleKey: "business_knowledge",
          targetId: "target-1",
          assignedToUserId: "approver-1",
        },
        "submitter-1",
      );

      expect(usersService.assertUserExists).toHaveBeenCalledWith("approver-1", "assignedToUserId");
    });

    it("rejects a nonexistent assignedToUserId with a clean 400, not a raw FK-violation 500", async () => {
      authorizationService.isValidModuleKey.mockResolvedValue(true);
      usersService.assertUserExists.mockRejectedValue(
        new BadRequestException("assignedToUserId does not resolve to an active user"),
      );

      await expect(
        svc.create(
          {
            targetModuleKey: "business_knowledge",
            targetId: "target-1",
            assignedToUserId: "no-such-user",
          },
          "submitter-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(reviews.create).not.toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    it("throws NotFoundException for a missing review", async () => {
      reviews.findById.mockResolvedValue(null);
      await expect(svc.findById("no-such-id")).rejects.toThrow(NotFoundException);
    });
  });

  describe("list", () => {
    it("resolves ?assignedToMe=true to the caller's own id", async () => {
      reviews.list.mockResolvedValue([review()]);
      await svc.list({ assignedToMe: true }, "actor-1");
      expect(reviews.list).toHaveBeenCalledWith(
        expect.objectContaining({ assignedToUserId: "actor-1" }),
      );
    });

    it("leaves assignedToUserId undefined when assignedToMe is not set", async () => {
      reviews.list.mockResolvedValue([]);
      await svc.list({}, "actor-1");
      expect(reviews.list).toHaveBeenCalledWith(
        expect.objectContaining({ assignedToUserId: undefined }),
      );
    });
  });

  describe("listDecisions", () => {
    it("returns a review's decision history after confirming it exists", async () => {
      reviews.findById.mockResolvedValue(review());
      reviewDecisions.listByReview.mockResolvedValue([decision()]);

      const result = await svc.listDecisions("review-1");

      expect(reviews.findById).toHaveBeenCalledWith("review-1");
      expect(reviewDecisions.listByReview).toHaveBeenCalledWith("review-1");
      expect(result).toEqual([decision()]);
    });

    it("throws NotFoundException for a nonexistent review, without querying decisions", async () => {
      reviews.findById.mockResolvedValue(null);

      await expect(svc.listDecisions("no-such-id")).rejects.toThrow(NotFoundException);
      expect(reviewDecisions.listByReview).not.toHaveBeenCalled();
    });
  });

  describe("decide", () => {
    it("requires the 'approve' action for approve/approve_with_notes/reject", async () => {
      reviews.findById.mockResolvedValue(review());
      reviews.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: review({ status: "approved" }),
      });

      await svc.decide(
        "review-1",
        { action: "approve", expectedStatus: "submitted" },
        "approver-1",
      );

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "approver-1",
        "review_center",
        "approve",
      );
    });

    it("requires only the 'review' action for request_revision", async () => {
      reviews.findById.mockResolvedValue(review());
      reviews.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: review({ status: "revision_requested" }),
      });

      await svc.decide(
        "review-1",
        { action: "request_revision", expectedStatus: "submitted" },
        "reviewer-1",
      );

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "reviewer-1",
        "review_center",
        "review",
      );
    });

    it("checks separation of duties AFTER the RBAC check, blocking the submitter from deciding their own review", async () => {
      reviews.findById.mockResolvedValue(review({ submittedByUserId: "same-user" }));
      separationOfDuties.assertDistinctActors.mockRejectedValue(
        new ForbiddenException("Separation of duties"),
      );

      await expect(
        svc.decide("review-1", { action: "approve", expectedStatus: "submitted" }, "same-user"),
      ).rejects.toThrow(ForbiddenException);

      expect(authorizationService.assertAllowed).toHaveBeenCalled();
      expect(separationOfDuties.assertDistinctActors).toHaveBeenCalledWith(
        "same-user",
        "same-user",
        "review approver",
        expect.objectContaining({ entityType: "review", entityId: "review-1" }),
      );
      expect(reviews.updateStatus).not.toHaveBeenCalled();
    });

    it("performs an atomic CAS on the caller-supplied expectedStatus and writes both a review_decisions row and an audit_events row, inside one transaction for the first two", async () => {
      reviews.findById.mockResolvedValue(review());
      reviews.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: review({ status: "approved" }),
      });

      const result = await svc.decide(
        "review-1",
        { action: "approve_with_notes", notes: "Great work", expectedStatus: "submitted" },
        "approver-1",
      );

      expect(reviews.updateStatus).toHaveBeenCalledWith(
        "review-1",
        "submitted",
        "approved",
        "approver-1",
        expect.any(Date),
        FAKE_TRANSACTION,
      );
      expect(reviewDecisions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          reviewId: "review-1",
          action: "approve_with_notes",
          actorUserId: "approver-1",
          notes: "Great work",
        }),
        FAKE_TRANSACTION,
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "approval",
          entityType: "review",
          action: "approve_with_notes",
          retentionCategory: "approval-audit-7y",
        }),
      );
      expect(result.status).toBe("approved");
    });

    it("maps reject to the rejected status", async () => {
      reviews.findById.mockResolvedValue(review());
      reviews.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: review({ status: "rejected" }),
      });

      await svc.decide("review-1", { action: "reject", expectedStatus: "submitted" }, "approver-1");

      expect(reviews.updateStatus).toHaveBeenCalledWith(
        "review-1",
        "submitted",
        "rejected",
        "approver-1",
        expect.any(Date),
        FAKE_TRANSACTION,
      );
    });

    it("throws ConflictException on a stale expectedStatus, without writing a decision or audit row", async () => {
      reviews.findById.mockResolvedValue(review());
      reviews.updateStatus.mockResolvedValue({
        outcome: "conflict",
        entity: review({ status: "approved" }),
      });

      await expect(
        svc.decide("review-1", { action: "reject", expectedStatus: "submitted" }, "approver-1"),
      ).rejects.toThrow(ConflictException);
      expect(reviewDecisions.create).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it("throws ConflictException re-deciding an already-terminal review (code-review fix — the repository itself now refuses this, surfaced here as a conflict outcome)", async () => {
      reviews.findById.mockResolvedValue(review({ status: "approved" }));
      reviews.updateStatus.mockResolvedValue({
        outcome: "conflict",
        entity: review({ status: "approved" }),
      });

      await expect(
        svc.decide("review-1", { action: "reject", expectedStatus: "approved" }, "approver-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("throws NotFoundException when the review disappears between the read and the CAS write", async () => {
      reviews.findById.mockResolvedValue(review());
      reviews.updateStatus.mockResolvedValue({ outcome: "not_found" });

      await expect(
        svc.decide("review-1", { action: "reject", expectedStatus: "submitted" }, "approver-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("still returns the updated review even if recording the audit event fails", async () => {
      reviews.findById.mockResolvedValue(review());
      reviews.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: review({ status: "approved" }),
      });
      auditService.record.mockRejectedValue(new Error("audit db down"));
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

      const result = await svc.decide(
        "review-1",
        { action: "approve", expectedStatus: "submitted" },
        "approver-1",
      );

      expect(result.status).toBe("approved");
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe("setPaused", () => {
    it("requires the 'review' action, then toggles isPaused and records a pause/resume decision (no audit_events write), inside one transaction", async () => {
      reviews.updatePaused.mockResolvedValue({
        outcome: "updated",
        entity: review({ isPaused: true }),
      });

      const result = await svc.setPaused(
        "review-1",
        { isPaused: true, expectedIsPaused: false },
        "reviewer-1",
      );

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "reviewer-1",
        "review_center",
        "review",
      );
      expect(reviews.updatePaused).toHaveBeenCalledWith("review-1", false, true, FAKE_TRANSACTION);
      expect(reviewDecisions.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: "pause", actorUserId: "reviewer-1" }),
        FAKE_TRANSACTION,
      );
      expect(auditService.record).not.toHaveBeenCalled();
      expect(result.isPaused).toBe(true);
    });

    it("records a resume decision when isPaused is false", async () => {
      reviews.updatePaused.mockResolvedValue({
        outcome: "updated",
        entity: review({ isPaused: false }),
      });

      await svc.setPaused("review-1", { isPaused: false, expectedIsPaused: true }, "reviewer-1");

      expect(reviewDecisions.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: "resume" }),
        FAKE_TRANSACTION,
      );
    });

    it("throws ConflictException when the review is already decided (terminal)", async () => {
      reviews.updatePaused.mockResolvedValue({
        outcome: "conflict",
        entity: review({ status: "approved" }),
      });

      await expect(
        svc.setPaused("review-1", { isPaused: true, expectedIsPaused: false }, "reviewer-1"),
      ).rejects.toThrow(ConflictException);
      expect(reviewDecisions.create).not.toHaveBeenCalled();
    });

    it("throws NotFoundException for a missing review", async () => {
      reviews.updatePaused.mockResolvedValue({ outcome: "not_found" });
      await expect(
        svc.setPaused("no-such-id", { isPaused: true, expectedIsPaused: false }, "reviewer-1"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("delegate", () => {
    it("requires the 'edit' action, validates the new assignee exists, then reassigns (CAS on expectedAssignedToUserId) and records a delegate decision (no audit_events write), inside one transaction", async () => {
      usersService.assertUserExists.mockResolvedValue(undefined);
      reviews.updateAssignee.mockResolvedValue({
        outcome: "updated",
        entity: review({ assignedToUserId: "new-assignee" }),
      });

      const result = await svc.delegate(
        "review-1",
        { assignedToUserId: "new-assignee", expectedAssignedToUserId: null },
        "admin-1",
      );

      expect(authorizationService.assertAllowed).toHaveBeenCalledWith(
        "admin-1",
        "review_center",
        "edit",
      );
      expect(usersService.assertUserExists).toHaveBeenCalledWith(
        "new-assignee",
        "assignedToUserId",
      );
      expect(reviews.updateAssignee).toHaveBeenCalledWith(
        "review-1",
        null,
        "new-assignee",
        FAKE_TRANSACTION,
      );
      expect(reviewDecisions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "delegate",
          actorUserId: "admin-1",
          delegatedToUserId: "new-assignee",
        }),
        FAKE_TRANSACTION,
      );
      expect(auditService.record).not.toHaveBeenCalled();
      expect(result.assignedToUserId).toBe("new-assignee");
    });

    it("rejects a nonexistent new assignee with a clean 400, before touching the repository", async () => {
      usersService.assertUserExists.mockRejectedValue(
        new BadRequestException("assignedToUserId does not resolve to an active user"),
      );

      await expect(
        svc.delegate(
          "review-1",
          { assignedToUserId: "no-such-user", expectedAssignedToUserId: null },
          "admin-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(reviews.updateAssignee).not.toHaveBeenCalled();
    });

    it("throws ConflictException on a stale expectedAssignedToUserId (the concurrent-delegate race, code-review fix)", async () => {
      usersService.assertUserExists.mockResolvedValue(undefined);
      reviews.updateAssignee.mockResolvedValue({
        outcome: "conflict",
        entity: review({ assignedToUserId: "someone-else" }),
      });

      await expect(
        svc.delegate(
          "review-1",
          { assignedToUserId: "new-assignee", expectedAssignedToUserId: "stale-assignee" },
          "admin-1",
        ),
      ).rejects.toThrow(ConflictException);
    });

    it("throws ConflictException when the review is already decided (terminal)", async () => {
      usersService.assertUserExists.mockResolvedValue(undefined);
      reviews.updateAssignee.mockResolvedValue({
        outcome: "conflict",
        entity: review({ status: "rejected" }),
      });

      await expect(
        svc.delegate(
          "review-1",
          { assignedToUserId: "new-assignee", expectedAssignedToUserId: null },
          "admin-1",
        ),
      ).rejects.toThrow(ConflictException);
    });

    it("throws NotFoundException for a missing review", async () => {
      usersService.assertUserExists.mockResolvedValue(undefined);
      reviews.updateAssignee.mockResolvedValue({ outcome: "not_found" });

      await expect(
        svc.delegate(
          "no-such-id",
          { assignedToUserId: "new-assignee", expectedAssignedToUserId: null },
          "admin-1",
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
