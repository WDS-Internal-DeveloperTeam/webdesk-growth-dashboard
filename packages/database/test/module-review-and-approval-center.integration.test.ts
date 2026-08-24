import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ReviewCommentRepository,
  ReviewDecisionRepository,
  ReviewRepository,
} from "../src/review-and-approval-center/index.js";
import { UserRepository } from "../src/auth/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Review and Approval Center schema (migration `00066`) against a REAL, disposable
 * PostgreSQL database. Mirrors ../test/module-content-template-library.integration.test.ts's own
 * structure, plus dedicated coverage for all three atomic compare-and-swap methods
 * (`updateStatus()`, `updatePaused()`, `updateAssignee()`) under genuinely concurrent writes, and
 * the terminal-status guards on `updatePaused()`/`updateAssignee()`. Separation-of-duties
 * enforcement (task package D4) lives at the service layer, not here — this file exercises the
 * persistence layer only.
 */
describe("Review and Approval Center module (real disposable database)", () => {
  const reviews = new ReviewRepository();
  const comments = new ReviewCommentRepository();
  const decisions = new ReviewDecisionRepository();
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

  describe("ReviewRepository", () => {
    it("creates a review defaulting to submitted status, unpaused, no decision recorded yet", async () => {
      const created = await reviews.create({
        targetModuleKey: "business_knowledge",
        targetId: randomUUID(),
        submittedByUserId: submitterId,
      });
      expect(created.status).toBe("submitted");
      expect(created.isPaused).toBe(false);
      expect(created.decidedByUserId).toBeNull();
      expect(created.decidedAt).toBeNull();
      expect(created.assignedToUserId).toBeNull();
    });

    it("round-trips targetLabel/assignedToUserId/versionALabel/versionBLabel", async () => {
      const created = await reviews.create({
        targetModuleKey: "service_library",
        targetId: randomUUID(),
        targetLabel: "Enterprise SEO Package v3",
        submittedByUserId: submitterId,
        assignedToUserId: approverId,
        versionALabel: "v3",
        versionBLabel: "v4",
      });
      const found = await reviews.findById(created.id);
      expect(found?.targetLabel).toBe("Enterprise SEO Package v3");
      expect(found?.assignedToUserId).toBe(approverId);
      expect(found?.versionALabel).toBe("v3");
      expect(found?.versionBLabel).toBe("v4");
    });

    it("findById returns null for a missing review", async () => {
      expect(await reviews.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("list() filters by status, targetModuleKey, and assignedToUserId", async () => {
      const target = randomUUID();
      const created = await reviews.create({
        targetModuleKey: "persona_library",
        targetId: target,
        submittedByUserId: submitterId,
        assignedToUserId: approverId,
      });

      const byStatus = await reviews.list({ status: "submitted" });
      expect(byStatus.map((r) => r.id)).toContain(created.id);

      const byModule = await reviews.list({ targetModuleKey: "persona_library" });
      expect(byModule.map((r) => r.id)).toContain(created.id);

      const byAssignee = await reviews.list({ assignedToUserId: approverId });
      expect(byAssignee.map((r) => r.id)).toContain(created.id);

      const byOtherModule = await reviews.list({ targetModuleKey: "no_such_module_key" });
      expect(byOtherModule.map((r) => r.id)).not.toContain(created.id);
    });

    it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
      const uniqueSuffix = randomUUID();
      const wildcardMatch = await reviews.create({
        targetModuleKey: "content_template_library",
        targetId: randomUUID(),
        targetLabel: `50% Off Page ${uniqueSuffix}`,
        submittedByUserId: submitterId,
      });
      const plainMatch = await reviews.create({
        targetModuleKey: "content_template_library",
        targetId: randomUUID(),
        targetLabel: `50X Off Page ${uniqueSuffix}`,
        submittedByUserId: submitterId,
      });

      const result = await reviews.list({ search: `50% Off Page ${uniqueSuffix}` });
      const ids = result.map((r) => r.id);
      expect(ids).toContain(wildcardMatch.id);
      expect(ids).not.toContain(plainMatch.id);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await reviews.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("rejects an invalid status at the database layer (real ENUM constraint)", async () => {
      const created = await reviews.create({
        targetModuleKey: "business_knowledge",
        targetId: randomUUID(),
        submittedByUserId: submitterId,
      });
      await expect(
        // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
        reviews.updateStatus(created.id, "submitted", "not_a_real_status", approverId, new Date()),
      ).rejects.toThrow();
    });

    describe("updateStatus() — atomic compare-and-swap", () => {
      it("changes status when the expected current status matches, and stamps decidedByUserId/decidedAt", async () => {
        const created = await reviews.create({
          targetModuleKey: "business_knowledge",
          targetId: randomUUID(),
          submittedByUserId: submitterId,
        });
        const decidedAt = new Date();
        const result = await reviews.updateStatus(
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
        const created = await reviews.create({
          targetModuleKey: "business_knowledge",
          targetId: randomUUID(),
          submittedByUserId: submitterId,
        });
        const firstDecision = await reviews.updateStatus(
          created.id,
          "submitted",
          "revision_requested",
          approverId,
          new Date(),
        );
        expect(firstDecision.outcome).toBe("updated");

        const laterDecidedAt = new Date(Date.now() + 60_000);
        const secondDecision = await reviews.updateStatus(
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

      it("reports not_found for a missing review", async () => {
        const result = await reviews.updateStatus(
          "00000000-0000-4000-8000-000000000000",
          "submitted",
          "approved",
          approverId,
          new Date(),
        );
        expect(result.outcome).toBe("not_found");
      });

      it("reports conflict (and does not write) on a stale expected status", async () => {
        const created = await reviews.create({
          targetModuleKey: "business_knowledge",
          targetId: randomUUID(),
          submittedByUserId: submitterId,
        });
        // The review is really "submitted"; claim we expected "revision_requested" — a stale read.
        const result = await reviews.updateStatus(
          created.id,
          "revision_requested",
          "approved",
          approverId,
          new Date(),
        );
        expect(result.outcome).toBe("conflict");
        expect(result.outcome === "conflict" && result.entity.status).toBe("submitted");

        const stillSubmitted = await reviews.findById(created.id);
        expect(stillSubmitted?.status).toBe("submitted");
        expect(stillSubmitted?.decidedByUserId).toBeNull();
      });

      it("under a genuine concurrent race (two simultaneous CAS calls with the same expected status), only one wins", async () => {
        const created = await reviews.create({
          targetModuleKey: "business_knowledge",
          targetId: randomUUID(),
          submittedByUserId: submitterId,
        });

        const [first, second] = await Promise.all([
          reviews.updateStatus(created.id, "submitted", "approved", approverId, new Date()),
          reviews.updateStatus(created.id, "submitted", "rejected", approverId, new Date()),
        ]);

        const outcomes = [first.outcome, second.outcome].sort();
        expect(outcomes).toEqual(["conflict", "updated"]);

        const final = await reviews.findById(created.id);
        expect(["approved", "rejected"]).toContain(final?.status);
      });

      it("reports conflict (and never reverses the decision) when expectedStatus is itself terminal (code-review fix)", async () => {
        const created = await reviews.create({
          targetModuleKey: "business_knowledge",
          targetId: randomUUID(),
          submittedByUserId: submitterId,
        });
        const decided = await reviews.updateStatus(
          created.id,
          "submitted",
          "approved",
          approverId,
          new Date(),
        );
        expect(decided.outcome).toBe("updated");

        // A caller who observed the review as "approved" and replays that as expectedStatus must
        // never be able to flip it to "rejected" — approved/rejected are permanently terminal.
        const reverseAttempt = await reviews.updateStatus(
          created.id,
          "approved",
          "rejected",
          submitterId,
          new Date(),
        );
        expect(reverseAttempt.outcome).toBe("conflict");

        const stillApproved = await reviews.findById(created.id);
        expect(stillApproved?.status).toBe("approved");
        expect(stillApproved?.decidedByUserId).toBe(approverId);
      });
    });

    describe("updatePaused() — atomic compare-and-swap, guarded against a terminal status", () => {
      it("pauses (false -> true) and resumes (true -> false)", async () => {
        const created = await reviews.create({
          targetModuleKey: "business_knowledge",
          targetId: randomUUID(),
          submittedByUserId: submitterId,
        });
        const paused = await reviews.updatePaused(created.id, false, true);
        expect(paused.outcome).toBe("updated");
        expect(paused.outcome === "updated" && paused.entity.isPaused).toBe(true);

        const resumed = await reviews.updatePaused(created.id, true, false);
        expect(resumed.outcome).toBe("updated");
        expect(resumed.outcome === "updated" && resumed.entity.isPaused).toBe(false);
      });

      it("reports conflict on a stale expectedIsPaused", async () => {
        const created = await reviews.create({
          targetModuleKey: "business_knowledge",
          targetId: randomUUID(),
          submittedByUserId: submitterId,
        });
        const result = await reviews.updatePaused(created.id, true, false);
        expect(result.outcome).toBe("conflict");
      });

      it("reports conflict once the review's status has become terminal (approved) — pausing a decided review is rejected", async () => {
        const created = await reviews.create({
          targetModuleKey: "business_knowledge",
          targetId: randomUUID(),
          submittedByUserId: submitterId,
        });
        const decided = await reviews.updateStatus(
          created.id,
          "submitted",
          "approved",
          approverId,
          new Date(),
        );
        expect(decided.outcome).toBe("updated");

        const pauseAttempt = await reviews.updatePaused(created.id, false, true);
        expect(pauseAttempt.outcome).toBe("conflict");

        const stillUnpaused = await reviews.findById(created.id);
        expect(stillUnpaused?.isPaused).toBe(false);
      });

      it("reports not_found for a missing review", async () => {
        const result = await reviews.updatePaused(
          "00000000-0000-4000-8000-000000000000",
          false,
          true,
        );
        expect(result.outcome).toBe("not_found");
      });
    });

    describe("updateAssignee() — atomic compare-and-swap on the prior assignee, guarded against a terminal status", () => {
      it("reassigns assignedToUserId on an open review when expectedAssignedToUserId matches", async () => {
        const created = await reviews.create({
          targetModuleKey: "business_knowledge",
          targetId: randomUUID(),
          submittedByUserId: submitterId,
        });
        const result = await reviews.updateAssignee(created.id, null, approverId);
        expect(result.outcome).toBe("updated");
        expect(result.outcome === "updated" && result.entity.assignedToUserId).toBe(approverId);
      });

      it("reports conflict (and does not write) on a stale expectedAssignedToUserId — the concurrent-delegate race (code-review fix)", async () => {
        const created = await reviews.create({
          targetModuleKey: "business_knowledge",
          targetId: randomUUID(),
          submittedByUserId: submitterId,
        });
        // The review is really unassigned (null); claim we expected it already assigned to
        // approverId — a stale read, exactly the shape of two concurrent delegate() calls racing.
        const result = await reviews.updateAssignee(created.id, approverId, submitterId);
        expect(result.outcome).toBe("conflict");

        const stillUnassigned = await reviews.findById(created.id);
        expect(stillUnassigned?.assignedToUserId).toBeNull();
      });

      it("reports conflict once the review's status has become terminal (rejected) — delegating a decided review is rejected", async () => {
        const created = await reviews.create({
          targetModuleKey: "business_knowledge",
          targetId: randomUUID(),
          submittedByUserId: submitterId,
        });
        const decided = await reviews.updateStatus(
          created.id,
          "submitted",
          "rejected",
          approverId,
          new Date(),
        );
        expect(decided.outcome).toBe("updated");

        const delegateAttempt = await reviews.updateAssignee(created.id, null, submitterId);
        expect(delegateAttempt.outcome).toBe("conflict");

        const stillOriginal = await reviews.findById(created.id);
        expect(stillOriginal?.assignedToUserId).toBeNull();
      });

      it("reports not_found for a missing review", async () => {
        const result = await reviews.updateAssignee(
          "00000000-0000-4000-8000-000000000000",
          null,
          approverId,
        );
        expect(result.outcome).toBe("not_found");
      });
    });
  });

  describe("ReviewCommentRepository", () => {
    it("creates and lists comments for a review, oldest first", async () => {
      const review = await reviews.create({
        targetModuleKey: "business_knowledge",
        targetId: randomUUID(),
        submittedByUserId: submitterId,
      });

      const first = await comments.create({
        reviewId: review.id,
        authorUserId: submitterId,
        body: "First comment",
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const second = await comments.create({
        reviewId: review.id,
        authorUserId: approverId,
        body: "Second comment",
      });

      const listed = await comments.listByReview(review.id);
      expect(listed.map((c) => c.id)).toEqual([first.id, second.id]);
      expect(listed[0]?.body).toBe("First comment");
      expect(listed[1]?.authorUserId).toBe(approverId);
    });

    it("returns an empty list for a review with no comments", async () => {
      const review = await reviews.create({
        targetModuleKey: "business_knowledge",
        targetId: randomUUID(),
        submittedByUserId: submitterId,
      });
      expect(await comments.listByReview(review.id)).toEqual([]);
    });

    it("rejects a comment for a nonexistent review at the database layer (real FK constraint)", async () => {
      await expect(
        comments.create({
          reviewId: "00000000-0000-4000-8000-000000000000",
          authorUserId: submitterId,
          body: "Orphan comment",
        }),
      ).rejects.toThrow();
    });
  });

  describe("ReviewDecisionRepository", () => {
    it("creates and lists decisions for a review, most recent first", async () => {
      const review = await reviews.create({
        targetModuleKey: "business_knowledge",
        targetId: randomUUID(),
        submittedByUserId: submitterId,
      });

      const first = await decisions.create({
        reviewId: review.id,
        action: "pause",
        actorUserId: submitterId,
      });
      await new Promise((resolve) => setTimeout(resolve, 5));
      const second = await decisions.create({
        reviewId: review.id,
        action: "resume",
        actorUserId: submitterId,
      });

      const listed = await decisions.listByReview(review.id);
      expect(listed.map((d) => d.id)).toEqual([second.id, first.id]);
    });

    it("round-trips delegatedToUserId, set only for a delegate action", async () => {
      const review = await reviews.create({
        targetModuleKey: "business_knowledge",
        targetId: randomUUID(),
        submittedByUserId: submitterId,
      });

      const delegation = await decisions.create({
        reviewId: review.id,
        action: "delegate",
        actorUserId: submitterId,
        delegatedToUserId: approverId,
      });
      expect(delegation.delegatedToUserId).toBe(approverId);

      const approval = await decisions.create({
        reviewId: review.id,
        action: "approve",
        actorUserId: approverId,
        notes: "Looks good",
      });
      expect(approval.delegatedToUserId).toBeNull();
      expect(approval.notes).toBe("Looks good");
    });

    it("accepts a caller-supplied decidedAt so a review's own decidedAt and its decision row agree exactly", async () => {
      const review = await reviews.create({
        targetModuleKey: "business_knowledge",
        targetId: randomUUID(),
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
      const review = await reviews.create({
        targetModuleKey: "business_knowledge",
        targetId: randomUUID(),
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
          action: "pause",
          actorUserId: submitterId,
        }),
      ).rejects.toThrow();
    });
  });
});
