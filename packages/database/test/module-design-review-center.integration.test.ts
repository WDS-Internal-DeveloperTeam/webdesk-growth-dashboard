import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  DesignReviewDecisionRepository,
  DesignReviewRepository,
} from "../src/design-review-center/index.js";
import { UserRepository } from "../src/auth/index.js";
import { closeConnection } from "../src/connection.js";
import { withTransaction } from "../src/transaction.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Design Review Center schema (migration `00089`) against a REAL, disposable
 * PostgreSQL database. Mirrors `../test/module-review-and-approval-center.integration.test.ts`'s
 * own structure, plus dedicated coverage for `reviewType`, the 5-value status (including the new
 * `superseded` terminal state), and `supersedeOtherApproved()` — the automatic-supersede mechanism
 * (D4) mirroring `WebsiteStrategyRecordRepository.supersedeOtherApprovedVersion()`'s own
 * already-reviewed pattern, but scoped to `(targetModuleKey, targetId, reviewType)` and returning
 * the superseded rows. Separation-of-duties enforcement lives at the service layer, not here —
 * this file exercises the persistence layer only.
 */
describe("Design Review Center module (real disposable database)", () => {
  const designReviews = new DesignReviewRepository();
  const decisions = new DesignReviewDecisionRepository();
  const users = new UserRepository();

  let submitterId: string;
  let approverId: string;

  beforeAll(async () => {
    const migrator = buildMigrator();
    await migrator.up();

    const submitter = await users.create({
      email: `submitter-${randomUUID()}@webdesksolution.com`,
      displayName: "Submitter",
    });
    submitterId = submitter.id;
    const approver = await users.create({
      email: `approver-${randomUUID()}@webdesksolution.com`,
      displayName: "Approver",
    });
    approverId = approver.id;
  });

  afterAll(async () => {
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  });

  describe("DesignReviewRepository", () => {
    it("creates a design review defaulting to submitted status, no decision recorded yet", async () => {
      const created = await designReviews.create({
        targetModuleKey: "component_library",
        targetId: randomUUID(),
        reviewType: "ui",
        submittedByUserId: submitterId,
      });
      expect(created.status).toBe("submitted");
      expect(created.reviewType).toBe("ui");
      expect(created.decidedByUserId).toBeNull();
      expect(created.decidedAt).toBeNull();
      expect(created.assignedToUserId).toBeNull();
    });

    it("round-trips targetLabel/reviewType/assignedToUserId/versionALabel/versionBLabel", async () => {
      const created = await designReviews.create({
        targetModuleKey: "design_token_library",
        targetId: randomUUID(),
        targetLabel: "Primary color palette v3",
        reviewType: "accessibility_by_design",
        submittedByUserId: submitterId,
        assignedToUserId: approverId,
        versionALabel: "v3",
        versionBLabel: "v4",
      });
      const found = await designReviews.findById(created.id);
      expect(found?.targetLabel).toBe("Primary color palette v3");
      expect(found?.reviewType).toBe("accessibility_by_design");
      expect(found?.assignedToUserId).toBe(approverId);
      expect(found?.versionALabel).toBe("v3");
      expect(found?.versionBLabel).toBe("v4");
    });

    it("findById returns null for a missing design review", async () => {
      expect(await designReviews.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("list() filters by status, targetModuleKey, reviewType, and assignedToUserId", async () => {
      const target = randomUUID();
      const created = await designReviews.create({
        targetModuleKey: "persona_library",
        targetId: target,
        reviewType: "conversion",
        submittedByUserId: submitterId,
        assignedToUserId: approverId,
      });

      const byStatus = await designReviews.list({ status: "submitted" });
      expect(byStatus.map((r) => r.id)).toContain(created.id);

      const byModule = await designReviews.list({ targetModuleKey: "persona_library" });
      expect(byModule.map((r) => r.id)).toContain(created.id);

      const byReviewType = await designReviews.list({ reviewType: "conversion" });
      expect(byReviewType.map((r) => r.id)).toContain(created.id);

      const byAssignee = await designReviews.list({ assignedToUserId: approverId });
      expect(byAssignee.map((r) => r.id)).toContain(created.id);

      const byOtherModule = await designReviews.list({ targetModuleKey: "no_such_module_key" });
      expect(byOtherModule.map((r) => r.id)).not.toContain(created.id);

      const byOtherReviewType = await designReviews.list({ reviewType: "motion" });
      expect(byOtherReviewType.map((r) => r.id)).not.toContain(created.id);
    });

    it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
      const uniqueSuffix = randomUUID();
      const wildcardMatch = await designReviews.create({
        targetModuleKey: "content_template_library",
        targetId: randomUUID(),
        targetLabel: `50% Off Page ${uniqueSuffix}`,
        reviewType: "ui",
        submittedByUserId: submitterId,
      });
      const plainMatch = await designReviews.create({
        targetModuleKey: "content_template_library",
        targetId: randomUUID(),
        targetLabel: `50X Off Page ${uniqueSuffix}`,
        reviewType: "ui",
        submittedByUserId: submitterId,
      });

      const result = await designReviews.list({ search: `50% Off Page ${uniqueSuffix}` });
      const ids = result.map((r) => r.id);
      expect(ids).toContain(wildcardMatch.id);
      expect(ids).not.toContain(plainMatch.id);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await designReviews.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("rejects an invalid status at the database layer (real ENUM constraint)", async () => {
      const created = await designReviews.create({
        targetModuleKey: "component_library",
        targetId: randomUUID(),
        reviewType: "ui",
        submittedByUserId: submitterId,
      });
      await expect(
        designReviews.updateStatus(
          created.id,
          "submitted",
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          "not_a_real_status",
          approverId,
          new Date(),
        ),
      ).rejects.toThrow();
    });

    it("rejects an invalid reviewType at the database layer (real ENUM constraint)", async () => {
      await expect(
        designReviews.create({
          targetModuleKey: "component_library",
          targetId: randomUUID(),
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          reviewType: "not_a_real_review_type",
          submittedByUserId: submitterId,
        }),
      ).rejects.toThrow();
    });

    describe("updateStatus() — atomic compare-and-swap", () => {
      it("changes status when the expected current status matches, and stamps decidedByUserId/decidedAt", async () => {
        const created = await designReviews.create({
          targetModuleKey: "component_library",
          targetId: randomUUID(),
          reviewType: "ui",
          submittedByUserId: submitterId,
        });
        const decidedAt = new Date();
        const result = await designReviews.updateStatus(
          created.id,
          "submitted",
          "approved",
          approverId,
          decidedAt,
        );
        expect(result.outcome).toBe("updated");
        expect(result.outcome === "updated" && result.entity.status).toBe("approved");
        expect(result.outcome === "updated" && result.entity.decidedByUserId).toBe(approverId);
        expect(result.outcome === "updated" && result.entity.decidedAt).toBe(
          decidedAt.toISOString(),
        );
      });

      it("overwrites decidedByUserId/decidedAt on a successive decision — never a 'stamp once' field", async () => {
        const created = await designReviews.create({
          targetModuleKey: "component_library",
          targetId: randomUUID(),
          reviewType: "ui",
          submittedByUserId: submitterId,
        });
        const firstDecision = await designReviews.updateStatus(
          created.id,
          "submitted",
          "revision_requested",
          approverId,
          new Date(),
        );
        expect(firstDecision.outcome).toBe("updated");

        const laterDecidedAt = new Date(Date.now() + 60_000);
        const secondDecision = await designReviews.updateStatus(
          created.id,
          "revision_requested",
          "approved",
          submitterId, // a different actor may decide the second time — not enforced at this layer
          laterDecidedAt,
        );
        expect(secondDecision.outcome).toBe("updated");
        expect(secondDecision.outcome === "updated" && secondDecision.entity.decidedByUserId).toBe(
          submitterId,
        );
        expect(secondDecision.outcome === "updated" && secondDecision.entity.decidedAt).toBe(
          laterDecidedAt.toISOString(),
        );
      });

      it("reports not_found for a missing design review", async () => {
        const result = await designReviews.updateStatus(
          "00000000-0000-4000-8000-000000000000",
          "submitted",
          "approved",
          approverId,
          new Date(),
        );
        expect(result.outcome).toBe("not_found");
      });

      it("reports conflict (and does not write) on a stale expected status", async () => {
        const created = await designReviews.create({
          targetModuleKey: "component_library",
          targetId: randomUUID(),
          reviewType: "ui",
          submittedByUserId: submitterId,
        });
        // The review is really "submitted"; claim we expected "revision_requested" — a stale read.
        const result = await designReviews.updateStatus(
          created.id,
          "revision_requested",
          "approved",
          approverId,
          new Date(),
        );
        expect(result.outcome).toBe("conflict");
        expect(result.outcome === "conflict" && result.entity.status).toBe("submitted");

        const stillSubmitted = await designReviews.findById(created.id);
        expect(stillSubmitted?.status).toBe("submitted");
        expect(stillSubmitted?.decidedByUserId).toBeNull();
      });

      it("under a genuine concurrent race (two simultaneous CAS calls with the same expected status), only one wins", async () => {
        const created = await designReviews.create({
          targetModuleKey: "component_library",
          targetId: randomUUID(),
          reviewType: "ui",
          submittedByUserId: submitterId,
        });

        const [first, second] = await Promise.all([
          designReviews.updateStatus(created.id, "submitted", "approved", approverId, new Date()),
          designReviews.updateStatus(created.id, "submitted", "rejected", approverId, new Date()),
        ]);

        const outcomes = [first.outcome, second.outcome].sort();
        expect(outcomes).toEqual(["conflict", "updated"]);

        const final = await designReviews.findById(created.id);
        expect(["approved", "rejected"]).toContain(final?.status);
      });

      it("reports conflict (and never reverses the decision) when expectedStatus is itself terminal", async () => {
        const created = await designReviews.create({
          targetModuleKey: "component_library",
          targetId: randomUUID(),
          reviewType: "ui",
          submittedByUserId: submitterId,
        });
        const decided = await designReviews.updateStatus(
          created.id,
          "submitted",
          "approved",
          approverId,
          new Date(),
        );
        expect(decided.outcome).toBe("updated");

        // A caller who observed the review as "approved" and replays that as expectedStatus must
        // never be able to flip it to "rejected" — approved/rejected/superseded are permanently
        // terminal.
        const reverseAttempt = await designReviews.updateStatus(
          created.id,
          "approved",
          "rejected",
          submitterId,
          new Date(),
        );
        expect(reverseAttempt.outcome).toBe("conflict");

        const stillApproved = await designReviews.findById(created.id);
        expect(stillApproved?.status).toBe("approved");
        expect(stillApproved?.decidedByUserId).toBe(approverId);
      });

      it("reports conflict re-deciding an already-superseded review (superseded is also terminal)", async () => {
        const targetId = randomUUID();
        const first = await designReviews.create({
          targetModuleKey: "component_library",
          targetId,
          reviewType: "ux",
          submittedByUserId: submitterId,
        });
        const second = await designReviews.create({
          targetModuleKey: "component_library",
          targetId,
          reviewType: "ux",
          submittedByUserId: submitterId,
        });

        await designReviews.updateStatus(first.id, "submitted", "approved", approverId, new Date());
        await withTransaction(async (transaction) => {
          const approveSecond = await designReviews.updateStatus(
            second.id,
            "submitted",
            "approved",
            approverId,
            new Date(),
            transaction,
          );
          expect(approveSecond.outcome).toBe("updated");
          await designReviews.supersedeOtherApproved(
            "component_library",
            targetId,
            "ux",
            second.id,
            transaction,
          );
        });

        const stillSuperseded = await designReviews.findById(first.id);
        expect(stillSuperseded?.status).toBe("superseded");

        // Replaying "superseded" as expectedStatus must never resurrect the review.
        const reverseAttempt = await designReviews.updateStatus(
          first.id,
          "superseded",
          "approved",
          submitterId,
          new Date(),
        );
        expect(reverseAttempt.outcome).toBe("conflict");
      });
    });

    describe("supersedeOtherApproved() — automatic supersede (D4)", () => {
      it("flips another approved review for the SAME (targetModuleKey, targetId, reviewType) tuple to superseded, and returns it", async () => {
        const targetId = randomUUID();
        const original = await designReviews.create({
          targetModuleKey: "design_token_library",
          targetId,
          reviewType: "creative_direction",
          submittedByUserId: submitterId,
        });
        const replacement = await designReviews.create({
          targetModuleKey: "design_token_library",
          targetId,
          reviewType: "creative_direction",
          submittedByUserId: submitterId,
        });

        const originalApproved = await designReviews.updateStatus(
          original.id,
          "submitted",
          "approved",
          approverId,
          new Date(),
        );
        expect(originalApproved.outcome).toBe("updated");

        await withTransaction(async (transaction) => {
          const replacementApproved = await designReviews.updateStatus(
            replacement.id,
            "submitted",
            "approved",
            approverId,
            new Date(),
            transaction,
          );
          expect(replacementApproved.outcome).toBe("updated");

          const superseded = await designReviews.supersedeOtherApproved(
            "design_token_library",
            targetId,
            "creative_direction",
            replacement.id,
            transaction,
          );
          expect(superseded).toHaveLength(1);
          expect(superseded[0]?.id).toBe(original.id);
          expect(superseded[0]?.status).toBe("superseded");
        });

        const finalOriginal = await designReviews.findById(original.id);
        expect(finalOriginal?.status).toBe("superseded");
        const finalReplacement = await designReviews.findById(replacement.id);
        expect(finalReplacement?.status).toBe("approved");
      });

      it("is a safe no-op (returns []) when no other approved review exists for that tuple", async () => {
        const targetId = randomUUID();
        const solo = await designReviews.create({
          targetModuleKey: "component_library",
          targetId,
          reviewType: "motion",
          submittedByUserId: submitterId,
        });

        await withTransaction(async (transaction) => {
          const approved = await designReviews.updateStatus(
            solo.id,
            "submitted",
            "approved",
            approverId,
            new Date(),
            transaction,
          );
          expect(approved.outcome).toBe("updated");

          const superseded = await designReviews.supersedeOtherApproved(
            "component_library",
            targetId,
            "motion",
            solo.id,
            transaction,
          );
          expect(superseded).toEqual([]);
        });
      });

      it("does NOT supersede an approved review with a DIFFERENT reviewType for the same target", async () => {
        const targetId = randomUUID();
        const uiReview = await designReviews.create({
          targetModuleKey: "component_library",
          targetId,
          reviewType: "ui",
          submittedByUserId: submitterId,
        });
        const uxReview = await designReviews.create({
          targetModuleKey: "component_library",
          targetId,
          reviewType: "ux",
          submittedByUserId: submitterId,
        });

        await designReviews.updateStatus(
          uiReview.id,
          "submitted",
          "approved",
          approverId,
          new Date(),
        );

        await withTransaction(async (transaction) => {
          await designReviews.updateStatus(
            uxReview.id,
            "submitted",
            "approved",
            approverId,
            new Date(),
            transaction,
          );
          const superseded = await designReviews.supersedeOtherApproved(
            "component_library",
            targetId,
            "ux",
            uxReview.id,
            transaction,
          );
          expect(superseded).toEqual([]);
        });

        const stillApprovedUi = await designReviews.findById(uiReview.id);
        expect(stillApprovedUi?.status).toBe("approved");
      });

      it("does NOT supersede an approved review for a DIFFERENT targetId", async () => {
        const reviewType = "performance_impact" as const;
        const targetA = await designReviews.create({
          targetModuleKey: "asset_library",
          targetId: randomUUID(),
          reviewType,
          submittedByUserId: submitterId,
        });
        const targetB = await designReviews.create({
          targetModuleKey: "asset_library",
          targetId: randomUUID(),
          reviewType,
          submittedByUserId: submitterId,
        });

        await designReviews.updateStatus(
          targetA.id,
          "submitted",
          "approved",
          approverId,
          new Date(),
        );

        await withTransaction(async (transaction) => {
          await designReviews.updateStatus(
            targetB.id,
            "submitted",
            "approved",
            approverId,
            new Date(),
            transaction,
          );
          const superseded = await designReviews.supersedeOtherApproved(
            "asset_library",
            targetB.targetId,
            reviewType,
            targetB.id,
            transaction,
          );
          expect(superseded).toEqual([]);
        });

        const stillApprovedA = await designReviews.findById(targetA.id);
        expect(stillApprovedA?.status).toBe("approved");
      });
    });
  });

  describe("DesignReviewDecisionRepository", () => {
    it("creates and lists decisions for a design review, most recent first", async () => {
      const review = await designReviews.create({
        targetModuleKey: "component_library",
        targetId: randomUUID(),
        reviewType: "ui",
        submittedByUserId: submitterId,
      });

      const first = await decisions.create({
        reviewId: review.id,
        action: "request_revision",
        actorUserId: approverId,
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const second = await decisions.create({
        reviewId: review.id,
        action: "approve",
        actorUserId: approverId,
      });

      const listed = await decisions.listByReview(review.id);
      expect(listed.map((d) => d.id)).toEqual([second.id, first.id]);
    });

    it("round-trips notes and the supersede action", async () => {
      const review = await designReviews.create({
        targetModuleKey: "component_library",
        targetId: randomUUID(),
        reviewType: "ui",
        submittedByUserId: submitterId,
      });

      const approval = await decisions.create({
        reviewId: review.id,
        action: "approve_with_notes",
        actorUserId: approverId,
        notes: "Looks good",
      });
      expect(approval.notes).toBe("Looks good");

      const supersede = await decisions.create({
        reviewId: review.id,
        action: "supersede",
        actorUserId: approverId,
      });
      expect(supersede.action).toBe("supersede");
      expect(supersede.notes).toBeNull();
    });

    it("accepts a caller-supplied decidedAt so a review's own decidedAt and its decision row agree exactly", async () => {
      const review = await designReviews.create({
        targetModuleKey: "component_library",
        targetId: randomUUID(),
        reviewType: "ui",
        submittedByUserId: submitterId,
      });
      const decidedAt = new Date();
      const decision = await decisions.create({
        reviewId: review.id,
        action: "approve",
        actorUserId: approverId,
        decidedAt,
      });
      expect(decision.decidedAt).toBe(decidedAt.toISOString());
    });

    it("rejects an invalid action at the database layer (real ENUM constraint)", async () => {
      const review = await designReviews.create({
        targetModuleKey: "component_library",
        targetId: randomUUID(),
        reviewType: "ui",
        submittedByUserId: submitterId,
      });
      await expect(
        decisions.create({
          reviewId: review.id,
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          action: "not_a_real_action",
          actorUserId: submitterId,
        }),
      ).rejects.toThrow();
    });

    it("rejects a decision for a nonexistent review at the database layer (real FK constraint)", async () => {
      await expect(
        decisions.create({
          reviewId: "00000000-0000-4000-8000-000000000000",
          action: "approve",
          actorUserId: submitterId,
        }),
      ).rejects.toThrow();
    });
  });
});
