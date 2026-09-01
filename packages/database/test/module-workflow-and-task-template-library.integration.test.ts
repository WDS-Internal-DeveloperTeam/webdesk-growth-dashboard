import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WorkflowTaskTemplateRepository } from "../src/workflow-and-task-template-library/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Workflow and Task Template Library schema (migration `00099`) against a REAL,
 * disposable PostgreSQL database. Mirrors
 * ../test/module-brand-library.integration.test.ts's own structure, including dedicated coverage
 * for the atomic compare-and-swap method (`updateApprovalStatus()`) under genuinely concurrent
 * writes. No `updatePublishState()` coverage — this module has no publish/unpublish mechanism.
 */
describe("Workflow and Task Template Library module (real disposable database)", () => {
  const templates = new WorkflowTaskTemplateRepository();

  let counter = 0;
  function uniqueId(prefix: string): string {
    counter += 1;
    return `${prefix}-${Date.now()}-${counter}`;
  }

  beforeAll(async () => {
    const migrator = buildMigrator();
    await migrator.up();
  });

  afterAll(async () => {
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  });

  describe("WorkflowTaskTemplateRepository", () => {
    it("creates a workflow task template defaulting to draft approvalStatus, version 1", async () => {
      const created = await templates.create({
        publicId: uniqueId("WTT"),
        templateType: "content",
        title: "Blog Post Template",
        authorizedStage: "content_production",
      });
      expect(created.approvalStatus).toBe("draft");
      expect(created.version).toBe(1);
      expect(created.requiredInputs).toBeNull();
      expect(created.expectedOutputs).toBeNull();
      expect(created.restrictions).toBeNull();
      expect(created.agentAssignment).toBeNull();
      expect(created.validationCriteria).toBeNull();
      expect(created.requiredApprovals).toBeNull();
    });

    it("round-trips every scalar content field", async () => {
      const created = await templates.create({
        publicId: uniqueId("WTT"),
        templateType: "security",
        title: "Security Review Template",
        authorizedStage: "pre_release_review",
        requiredInputs: "Threat model, dependency audit",
        expectedOutputs: "Signed-off security review report",
        restrictions: "Cannot authorize execution by itself",
        agentAssignment: "qa_security_reviewer",
        validationCriteria: "No Critical/High findings open",
        requiredApprovals: "QA and security sign-off required",
      });
      const found = await templates.findById(created.id);
      expect(found?.requiredInputs).toBe("Threat model, dependency audit");
      expect(found?.expectedOutputs).toBe("Signed-off security review report");
      expect(found?.restrictions).toBe("Cannot authorize execution by itself");
      expect(found?.agentAssignment).toBe("qa_security_reviewer");
      expect(found?.validationCriteria).toBe("No Critical/High findings open");
      expect(found?.requiredApprovals).toBe("QA and security sign-off required");
    });

    it("rejects an invalid templateType at the database layer (real ENUM constraint)", async () => {
      await expect(
        templates.create({
          publicId: uniqueId("WTT"),
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          templateType: "not_a_real_type",
          title: "X",
          authorizedStage: "x",
        }),
      ).rejects.toThrow();
    });

    it("rejects a duplicate publicId at the database layer", async () => {
      const publicId = uniqueId("WTT");
      await templates.create({
        publicId,
        templateType: "content",
        title: "First",
        authorizedStage: "content_production",
      });
      await expect(
        templates.create({
          publicId,
          templateType: "content",
          title: "Second",
          authorizedStage: "content_production",
        }),
      ).rejects.toThrow();
    });

    it("finds by publicId, and returns null for a missing one", async () => {
      const publicId = uniqueId("WTT");
      const created = await templates.create({
        publicId,
        templateType: "content",
        title: "X",
        authorizedStage: "content_production",
      });
      expect((await templates.findByPublicId(publicId))?.id).toBe(created.id);
      expect(await templates.findByPublicId("WTT-does-not-exist")).toBeNull();
    });

    it("findById returns null for a missing workflow task template", async () => {
      expect(await templates.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("list() filters by templateType, approvalStatus, and search (case-insensitive)", async () => {
      const uniqueTitle = uniqueId("Unique Searchable Title");
      await templates.create({
        publicId: uniqueId("WTT"),
        templateType: "qa",
        title: uniqueTitle,
        authorizedStage: "qa_review",
      });

      const byType = await templates.list({ templateType: "qa" });
      expect(byType.length).toBeGreaterThanOrEqual(1);

      const byStatus = await templates.list({ approvalStatus: "draft" });
      expect(byStatus.length).toBeGreaterThanOrEqual(1);

      const bySearch = await templates.list({ search: uniqueTitle.toLowerCase() });
      expect(bySearch.length).toBe(1);
    });

    it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
      const uniqueSuffix = uniqueId("PCT");
      const wildcardMatch = await templates.create({
        publicId: uniqueId("WTT"),
        templateType: "content",
        title: `50% Off Template ${uniqueSuffix}`,
        authorizedStage: "content_production",
      });
      const plainMatch = await templates.create({
        publicId: uniqueId("WTT"),
        templateType: "content",
        title: `50X Off Template ${uniqueSuffix}`,
        authorizedStage: "content_production",
      });

      const result = await templates.list({ search: `50% Off Template ${uniqueSuffix}` });
      const ids = result.map((r) => r.id);
      expect(ids).toContain(wildcardMatch.id);
      expect(ids).not.toContain(plainMatch.id);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await templates.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("update() changes content fields, increments version by exactly 1, and never touches approvalStatus/templateType", async () => {
      const created = await templates.create({
        publicId: uniqueId("WTT"),
        templateType: "design",
        title: "Original",
        authorizedStage: "design_review",
      });
      expect(created.version).toBe(1);

      const updated = await templates.update(created.id, { title: "Renamed" });
      expect(updated?.title).toBe("Renamed");
      expect(updated?.templateType).toBe("design");
      expect(updated?.approvalStatus).toBe("draft");
      expect(updated?.version).toBe(2);

      const updatedAgain = await templates.update(created.id, { title: "Renamed Again" });
      expect(updatedAgain?.version).toBe(3);
    });

    it("update()'s optional expectedApprovalStatus guard rejects (returns null) a stale-status write and leaves the row untouched", async () => {
      const created = await templates.create({
        publicId: uniqueId("WTT"),
        templateType: "content",
        title: "CAS Guard Fixture",
        authorizedStage: "content_production",
      });

      // Claim we expected the row to still be "submitted" when it's really "draft" — a stale read.
      const result = await templates.update(created.id, { title: "Should Not Apply" }, "submitted");
      expect(result).toBeNull();

      const stillOriginal = await templates.findById(created.id);
      expect(stillOriginal?.title).toBe("CAS Guard Fixture");
      expect(stillOriginal?.version).toBe(1);
    });

    it("update() with the correct expectedApprovalStatus succeeds normally", async () => {
      const created = await templates.create({
        publicId: uniqueId("WTT"),
        templateType: "content",
        title: "CAS Guard Match Fixture",
        authorizedStage: "content_production",
      });

      const result = await templates.update(created.id, { title: "Renamed" }, "draft");
      expect(result?.title).toBe("Renamed");
      expect(result?.version).toBe(2);
    });

    it("update() with concurrent-style repeated calls still increments version atomically (no lost updates)", async () => {
      const created = await templates.create({
        publicId: uniqueId("WTT"),
        templateType: "content",
        title: "Concurrency Fixture",
        authorizedStage: "content_production",
      });

      await Promise.all([
        templates.update(created.id, { requiredInputs: "A" }),
        templates.update(created.id, { requiredInputs: "B" }),
        templates.update(created.id, { requiredInputs: "C" }),
      ]);

      const final = await templates.findById(created.id);
      expect(final?.version).toBe(4); // 1 (create) + 3 concurrent updates
    });

    it("update() returns null for a missing workflow task template", async () => {
      expect(
        await templates.update("00000000-0000-4000-8000-000000000000", { title: "x" }),
      ).toBeNull();
    });

    it("update() stores an explicit null on a nullable text field directly, distinct from leaving it untouched", async () => {
      const created = await templates.create({
        publicId: uniqueId("WTT"),
        templateType: "content",
        title: "Clearing Fixture",
        authorizedStage: "content_production",
        requiredInputs: "Some inputs",
        expectedOutputs: "Some outputs",
      });

      const updated = await templates.update(created.id, { requiredInputs: null });
      expect(updated?.requiredInputs).toBeNull();
      expect(updated?.expectedOutputs).toBe("Some outputs");
    });

    describe("updateApprovalStatus() — atomic compare-and-swap", () => {
      it("changes approvalStatus when the expected current status matches, and does not touch version", async () => {
        const created = await templates.create({
          publicId: uniqueId("WTT"),
          templateType: "content",
          title: "Status Fixture",
          authorizedStage: "content_production",
        });
        const result = await templates.updateApprovalStatus(created.id, "draft", "submitted", null);
        expect(result.outcome).toBe("updated");
        expect(result.outcome === "updated" && result.entity.approvalStatus).toBe("submitted");
        expect(result.outcome === "updated" && result.entity.version).toBe(1);
      });

      it("reports not_found for a missing workflow task template", async () => {
        const result = await templates.updateApprovalStatus(
          "00000000-0000-4000-8000-000000000000",
          "draft",
          "submitted",
          null,
        );
        expect(result.outcome).toBe("not_found");
      });

      it("reports conflict (and does not write) on the atomic compare-and-swap", async () => {
        const created = await templates.create({
          publicId: uniqueId("WTT"),
          templateType: "content",
          title: "Conflict Fixture",
          authorizedStage: "content_production",
        });
        // The record is really `draft`; claim we expected `submitted` — a stale read.
        const result = await templates.updateApprovalStatus(
          created.id,
          "submitted",
          "under_review",
          null,
        );
        expect(result.outcome).toBe("conflict");
        expect(result.outcome === "conflict" && result.entity.approvalStatus).toBe("draft");

        const stillDraft = await templates.findById(created.id);
        expect(stillDraft?.approvalStatus).toBe("draft");
      });

      it("under a genuine concurrent race (two simultaneous CAS calls with the same expected status), only one wins", async () => {
        const created = await templates.create({
          publicId: uniqueId("WTT"),
          templateType: "content",
          title: "Real Race Fixture",
          authorizedStage: "content_production",
        });

        const [first, second] = await Promise.all([
          templates.updateApprovalStatus(created.id, "draft", "submitted", null),
          templates.updateApprovalStatus(created.id, "draft", "archived", null),
        ]);

        const outcomes = [first.outcome, second.outcome].sort();
        expect(outcomes).toEqual(["conflict", "updated"]);

        const final = await templates.findById(created.id);
        expect(["submitted", "archived"]).toContain(final?.approvalStatus);
      });

      it("rejects an invalid approvalStatus at the database layer (real ENUM constraint)", async () => {
        const created = await templates.create({
          publicId: uniqueId("WTT"),
          templateType: "content",
          title: "y",
          authorizedStage: "content_production",
        });
        await expect(
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          templates.updateApprovalStatus(created.id, "draft", "not_a_real_status", null),
        ).rejects.toThrow();
      });
    });
  });
});
