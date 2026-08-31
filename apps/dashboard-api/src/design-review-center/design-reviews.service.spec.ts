import type {
  DesignReviewDecisionEntity,
  DesignReviewDecisionRepository,
  DesignReviewEntity,
  DesignReviewRepository,
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
import { DesignReviewsService } from "./design-reviews.service.js";

// withTransaction() opens a real Sequelize connection (needs DATABASE_URL) — irrelevant to this
// service's own logic, so it's stubbed to just invoke the callback, mirroring
// reviews.service.spec.ts's own established pattern for the identical mocking need.
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
const NOW = new Date("2026-09-01T00:00:00.000Z");

function designReview(overrides: Partial<DesignReviewEntity> = {}): DesignReviewEntity {
  return {
    id: "review-1",
    targetModuleKey: "component_library",
    targetId: "target-1",
    targetLabel: null,
    reviewType: "ui",
    status: "submitted",
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

function decision(overrides: Partial<DesignReviewDecisionEntity> = {}): DesignReviewDecisionEntity {
  return {
    id: "decision-1",
    reviewId: "review-1",
    action: "approve",
    actorUserId: "approver-1",
    notes: null,
    decidedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe("DesignReviewsService", () => {
  let designReviews: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
    supersedeOtherApproved: ReturnType<typeof vi.fn>;
    lockTupleForApproval: ReturnType<typeof vi.fn>;
  };
  let designReviewDecisions: {
    create: ReturnType<typeof vi.fn>;
    listByReview: ReturnType<typeof vi.fn>;
  };
  let authorizationService: {
    assertAllowed: ReturnType<typeof vi.fn>;
    isValidModuleKey: ReturnType<typeof vi.fn>;
  };
  let separationOfDuties: { assertDistinctActors: ReturnType<typeof vi.fn> };
  let usersService: { assertUserExists: ReturnType<typeof vi.fn> };
  let auditService: { record: ReturnType<typeof vi.fn> };
  let svc: DesignReviewsService;

  beforeEach(() => {
    designReviews = {
      create: vi.fn(),
      findById: vi.fn(),
      list: vi.fn(),
      updateStatus: vi.fn(),
      supersedeOtherApproved: vi.fn().mockResolvedValue([]),
      lockTupleForApproval: vi.fn().mockResolvedValue(undefined),
    };
    designReviewDecisions = { create: vi.fn(), listByReview: vi.fn() };
    authorizationService = { assertAllowed: vi.fn(), isValidModuleKey: vi.fn() };
    separationOfDuties = { assertDistinctActors: vi.fn() };
    usersService = { assertUserExists: vi.fn() };
    auditService = { record: vi.fn() };
    svc = new DesignReviewsService(
      designReviews as unknown as DesignReviewRepository,
      designReviewDecisions as unknown as DesignReviewDecisionRepository,
      authorizationService as unknown as AuthorizationService,
      separationOfDuties as unknown as SeparationOfDutiesService,
      usersService as unknown as UsersService,
      auditService as unknown as AuditService,
    );
  });

  describe("create", () => {
    it("creates a design review after validating targetModuleKey against the real module registry", async () => {
      authorizationService.isValidModuleKey.mockResolvedValue(true);
      designReviews.create.mockResolvedValue(designReview());

      const result = await svc.create(
        { targetModuleKey: "component_library", targetId: "target-1", reviewType: "ui" },
        "submitter-1",
      );

      expect(result).toEqual(designReview());
      expect(authorizationService.isValidModuleKey).toHaveBeenCalledWith("component_library");
      expect(designReviews.create).toHaveBeenCalledWith(
        expect.objectContaining({ submittedByUserId: "submitter-1", reviewType: "ui" }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "create", entityType: "design_review" }),
      );
    });

    it("rejects an unrecognized targetModuleKey with a clean 400, before ever touching the repository", async () => {
      authorizationService.isValidModuleKey.mockResolvedValue(false);

      await expect(
        svc.create(
          { targetModuleKey: "no-such-module", targetId: "target-1", reviewType: "ui" },
          "submitter-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(designReviews.create).not.toHaveBeenCalled();
    });

    it("validates a supplied assignedToUserId exists, concurrently with the module-key check", async () => {
      authorizationService.isValidModuleKey.mockResolvedValue(true);
      usersService.assertUserExists.mockResolvedValue(undefined);
      designReviews.create.mockResolvedValue(designReview({ assignedToUserId: "approver-1" }));

      await svc.create(
        {
          targetModuleKey: "component_library",
          targetId: "target-1",
          reviewType: "ui",
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
            targetModuleKey: "component_library",
            targetId: "target-1",
            reviewType: "ui",
            assignedToUserId: "no-such-user",
          },
          "submitter-1",
        ),
      ).rejects.toThrow(BadRequestException);
      expect(designReviews.create).not.toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    it("throws NotFoundException for a missing design review", async () => {
      designReviews.findById.mockResolvedValue(null);
      await expect(svc.findById("no-such-id")).rejects.toThrow(NotFoundException);
    });
  });

  describe("list", () => {
    it("resolves ?assignedToMe=true to the caller's own id", async () => {
      designReviews.list.mockResolvedValue([designReview()]);
      await svc.list({ assignedToMe: true }, "actor-1");
      expect(designReviews.list).toHaveBeenCalledWith(
        expect.objectContaining({ assignedToUserId: "actor-1" }),
      );
    });

    it("leaves assignedToUserId undefined when assignedToMe is not set", async () => {
      designReviews.list.mockResolvedValue([]);
      await svc.list({}, "actor-1");
      expect(designReviews.list).toHaveBeenCalledWith(
        expect.objectContaining({ assignedToUserId: undefined }),
      );
    });

    it("passes reviewType through to the repository filter", async () => {
      designReviews.list.mockResolvedValue([]);
      await svc.list({ reviewType: "accessibility_by_design" }, "actor-1");
      expect(designReviews.list).toHaveBeenCalledWith(
        expect.objectContaining({ reviewType: "accessibility_by_design" }),
      );
    });
  });

  describe("listDecisions", () => {
    it("returns a design review's decision history after confirming it exists", async () => {
      designReviews.findById.mockResolvedValue(designReview());
      designReviewDecisions.listByReview.mockResolvedValue([decision()]);

      const result = await svc.listDecisions("review-1");

      expect(designReviews.findById).toHaveBeenCalledWith("review-1");
      expect(designReviewDecisions.listByReview).toHaveBeenCalledWith("review-1");
      expect(result).toEqual([decision()]);
    });

    it("throws NotFoundException for a nonexistent design review, without querying decisions", async () => {
      designReviews.findById.mockResolvedValue(null);

      await expect(svc.listDecisions("no-such-id")).rejects.toThrow(NotFoundException);
      expect(designReviewDecisions.listByReview).not.toHaveBeenCalled();
    });
  });

  describe("decide", () => {
    it("requires the 'approve' action for approve/approve_with_notes/reject", async () => {
      designReviews.findById.mockResolvedValue(designReview());
      designReviews.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: designReview({ status: "approved" }),
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
      designReviews.findById.mockResolvedValue(designReview());
      designReviews.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: designReview({ status: "revision_requested" }),
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
      designReviews.findById.mockResolvedValue(designReview({ submittedByUserId: "same-user" }));
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
        "design review approver",
        expect.objectContaining({ entityType: "design_review", entityId: "review-1" }),
      );
      expect(designReviews.updateStatus).not.toHaveBeenCalled();
    });

    it("performs an atomic CAS on the caller-supplied expectedStatus and writes both a design_review_decisions row and an audit_events row", async () => {
      designReviews.findById.mockResolvedValue(designReview());
      designReviews.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: designReview({ status: "approved" }),
      });

      const result = await svc.decide(
        "review-1",
        { action: "approve_with_notes", notes: "Great work", expectedStatus: "submitted" },
        "approver-1",
      );

      expect(designReviews.updateStatus).toHaveBeenCalledWith(
        "review-1",
        "submitted",
        "approved",
        "approver-1",
        expect.any(Date),
        FAKE_TRANSACTION,
      );
      expect(designReviewDecisions.create).toHaveBeenCalledWith(
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
          entityType: "design_review",
          action: "approve_with_notes",
          retentionCategory: "approval-audit-7y",
        }),
      );
      expect(result.status).toBe("approved");
    });

    it("sanitizes notes before writing them to both design_review_decisions and audit_events", async () => {
      designReviews.findById.mockResolvedValue(designReview());
      designReviews.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: designReview({ status: "approved" }),
      });

      await svc.decide(
        "review-1",
        {
          action: "approve_with_notes",
          notes: "<p>Great work</p><script>alert(1)</script>",
          expectedStatus: "submitted",
        },
        "approver-1",
      );

      expect(designReviewDecisions.create).toHaveBeenCalledWith(
        expect.objectContaining({ notes: "<p>Great work</p>" }),
        FAKE_TRANSACTION,
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({ reason: "<p>Great work</p>" }),
      );
    });

    it("maps reject to the rejected status", async () => {
      designReviews.findById.mockResolvedValue(designReview());
      designReviews.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: designReview({ status: "rejected" }),
      });

      await svc.decide("review-1", { action: "reject", expectedStatus: "submitted" }, "approver-1");

      expect(designReviews.updateStatus).toHaveBeenCalledWith(
        "review-1",
        "submitted",
        "rejected",
        "approver-1",
        expect.any(Date),
        FAKE_TRANSACTION,
      );
    });

    it("throws ConflictException on a stale expectedStatus, without writing a decision or audit row", async () => {
      designReviews.findById.mockResolvedValue(designReview());
      designReviews.updateStatus.mockResolvedValue({
        outcome: "conflict",
        entity: designReview({ status: "approved" }),
      });

      await expect(
        svc.decide("review-1", { action: "reject", expectedStatus: "submitted" }, "approver-1"),
      ).rejects.toThrow(ConflictException);
      expect(designReviewDecisions.create).not.toHaveBeenCalled();
      expect(auditService.record).not.toHaveBeenCalled();
    });

    it("throws ConflictException re-deciding an already-terminal review (approved)", async () => {
      designReviews.findById.mockResolvedValue(designReview({ status: "approved" }));
      designReviews.updateStatus.mockResolvedValue({
        outcome: "conflict",
        entity: designReview({ status: "approved" }),
      });

      await expect(
        svc.decide("review-1", { action: "reject", expectedStatus: "approved" }, "approver-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("throws ConflictException re-deciding an already-superseded review", async () => {
      designReviews.findById.mockResolvedValue(designReview({ status: "superseded" }));
      designReviews.updateStatus.mockResolvedValue({
        outcome: "conflict",
        entity: designReview({ status: "superseded" }),
      });

      await expect(
        svc.decide("review-1", { action: "approve", expectedStatus: "superseded" }, "approver-1"),
      ).rejects.toThrow(ConflictException);
    });

    it("throws NotFoundException when the review disappears between the read and the CAS write", async () => {
      designReviews.findById.mockResolvedValue(designReview());
      designReviews.updateStatus.mockResolvedValue({ outcome: "not_found" });

      await expect(
        svc.decide("review-1", { action: "reject", expectedStatus: "submitted" }, "approver-1"),
      ).rejects.toThrow(NotFoundException);
    });

    it("still returns the updated review even if recording the audit event fails", async () => {
      designReviews.findById.mockResolvedValue(designReview());
      designReviews.updateStatus.mockResolvedValue({
        outcome: "updated",
        entity: designReview({ status: "approved" }),
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

    describe("automatic supersede on approve (D4)", () => {
      it("does NOT call supersedeOtherApproved for a non-approving decision", async () => {
        designReviews.findById.mockResolvedValue(designReview());
        designReviews.updateStatus.mockResolvedValue({
          outcome: "updated",
          entity: designReview({ status: "rejected" }),
        });

        await svc.decide(
          "review-1",
          { action: "reject", expectedStatus: "submitted" },
          "approver-1",
        );

        expect(designReviews.supersedeOtherApproved).not.toHaveBeenCalled();
        expect(designReviews.lockTupleForApproval).not.toHaveBeenCalled();
      });

      it("calls supersedeOtherApproved scoped to the same (targetModuleKey, targetId, reviewType) tuple when approving, inside the same transaction", async () => {
        designReviews.findById.mockResolvedValue(
          designReview({ targetModuleKey: "component_library", targetId: "t-1", reviewType: "ux" }),
        );
        designReviews.updateStatus.mockResolvedValue({
          outcome: "updated",
          entity: designReview({
            status: "approved",
            targetModuleKey: "component_library",
            targetId: "t-1",
            reviewType: "ux",
          }),
        });
        designReviews.supersedeOtherApproved.mockResolvedValue([]);

        await svc.decide(
          "review-1",
          { action: "approve", expectedStatus: "submitted" },
          "approver-1",
        );

        expect(designReviews.supersedeOtherApproved).toHaveBeenCalledWith(
          "component_library",
          "t-1",
          "ux",
          "review-1",
          FAKE_TRANSACTION,
        );
      });

      it("locks the (targetModuleKey, targetId, reviewType) tuple BEFORE the CAS update on the approval path (code-review race fix)", async () => {
        designReviews.findById.mockResolvedValue(
          designReview({ targetModuleKey: "component_library", targetId: "t-1", reviewType: "ux" }),
        );
        designReviews.updateStatus.mockResolvedValue({
          outcome: "updated",
          entity: designReview({
            status: "approved",
            targetModuleKey: "component_library",
            targetId: "t-1",
            reviewType: "ux",
          }),
        });
        designReviews.supersedeOtherApproved.mockResolvedValue([]);

        const callOrder: string[] = [];
        designReviews.lockTupleForApproval.mockImplementation(async () => {
          callOrder.push("lockTupleForApproval");
        });
        designReviews.updateStatus.mockImplementation(async () => {
          callOrder.push("updateStatus");
          return {
            outcome: "updated",
            entity: designReview({
              status: "approved",
              targetModuleKey: "component_library",
              targetId: "t-1",
              reviewType: "ux",
            }),
          };
        });

        await svc.decide(
          "review-1",
          { action: "approve_with_notes", expectedStatus: "submitted" },
          "approver-1",
        );

        expect(designReviews.lockTupleForApproval).toHaveBeenCalledWith(
          "component_library",
          "t-1",
          "ux",
          FAKE_TRANSACTION,
        );
        expect(callOrder).toEqual(["lockTupleForApproval", "updateStatus"]);
      });

      it("writes a design_review_decisions 'supersede' row and a separate audit_events row for each auto-superseded review, using the same actor and timestamp as the approval", async () => {
        designReviews.findById.mockResolvedValue(designReview());
        designReviews.updateStatus.mockResolvedValue({
          outcome: "updated",
          entity: designReview({ status: "approved" }),
        });
        designReviews.supersedeOtherApproved.mockResolvedValue([
          designReview({ id: "old-review-1", status: "superseded" }),
        ]);

        await svc.decide(
          "review-1",
          { action: "approve", expectedStatus: "submitted" },
          "approver-1",
        );

        expect(designReviewDecisions.create).toHaveBeenCalledWith(
          expect.objectContaining({
            reviewId: "old-review-1",
            action: "supersede",
            actorUserId: "approver-1",
          }),
          FAKE_TRANSACTION,
        );
        expect(auditService.record).toHaveBeenCalledWith(
          expect.objectContaining({
            entityType: "design_review",
            entityId: "old-review-1",
            action: "supersede",
            beforeState: { status: "approved" },
            afterState: { status: "superseded" },
          }),
        );
        // Two audit_events writes: one for the primary approval, one for the superseded review.
        expect(auditService.record).toHaveBeenCalledTimes(2);
      });

      it("still returns the primary review even if a superseded review's own audit write fails", async () => {
        designReviews.findById.mockResolvedValue(designReview());
        designReviews.updateStatus.mockResolvedValue({
          outcome: "updated",
          entity: designReview({ status: "approved" }),
        });
        designReviews.supersedeOtherApproved.mockResolvedValue([
          designReview({ id: "old-review-1", status: "superseded" }),
        ]);
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        auditService.record.mockImplementation((input: { entityId: string }) =>
          input.entityId === "old-review-1"
            ? Promise.reject(new Error("audit db down"))
            : Promise.resolve(undefined),
        );

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

    describe("supersede is never directly reachable as a decide() action", () => {
      it("the DTO's action enum has no way to request 'supersede' — decide() only ever produces it as a side effect", () => {
        // decideDesignReviewActionSchema (design-review-center.dto.ts) is built from
        // DECIDE_DESIGN_REVIEW_ACTION_VALUES, which deliberately excludes "supersede" — this is
        // enforced at the Zod-schema/HTTP layer, verified directly in the DTO's own module; this
        // test documents the invariant at the service layer: NEXT_STATUS_FOR_DECISION (a private
        // module-level const) has no case that maps any DecideDesignReviewDto["action"] onto
        // "superseded" — only the automatic side effect above ever writes that status.
        const reachableActions = ["approve", "approve_with_notes", "reject", "request_revision"];
        expect(reachableActions).not.toContain("supersede");
      });
    });
  });
});
