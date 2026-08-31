import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SectionPatternRecordRepository } from "../src/section-and-pattern-library/index.js";
import { closeConnection, getConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";
import { withTransaction } from "../src/transaction.js";

/**
 * Exercises the Section and Pattern Library schema (migration `00080`) against a REAL, disposable
 * PostgreSQL database. Mirrors ../test/module-design-token-library.integration.test.ts's own
 * structure — real multi-row version history: the partial-unique-index-on-`is_current` behavior,
 * the `(record_id, version_number)` uniqueness, and a full end-to-end version-history round trip
 * (create -> approve -> edit-the-approved-one -> verify 2 rows exist -> approve the new one ->
 * verify the old row is superseded).
 */
describe("Section and Pattern Library module (real disposable database)", () => {
  const patterns = new SectionPatternRecordRepository();

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

  describe("SectionPatternRecordRepository — basic CRUD", () => {
    it("creates a record defaulting to draft approvalStatus, versionNumber 1, isCurrent true", async () => {
      const created = await patterns.create({
        publicId: uniqueId("SPL-HERO"),
        patternType: "homepage_storytelling",
        name: "Homepage hero",
      });
      expect(created.approvalStatus).toBe("draft");
      expect(created.versionNumber).toBe(1);
      expect(created.isCurrent).toBe(true);
      expect(created.recordId).toBeTruthy();
      // Each newly created record gets its own fresh recordId — never the same as its own row id
      // by coincidence being asserted here, just confirming it is a real, distinct UUID.
      expect(created.recordId).not.toBe(created.id);
      expect(created.jsDependencies).toEqual([]);
      expect(created.tokenReferences).toEqual([]);
      expect(created.relatedComponentIds).toEqual([]);
    });

    it("stores array fields as real arrays, defaulting to empty", async () => {
      const created = await patterns.create({
        publicId: uniqueId("SPL-TRUST"),
        patternType: "trust",
        name: "Trust badges",
        jsDependencies: ["slick-carousel"],
        tokenReferences: ["color-primary-500"],
        relatedComponentIds: ["badge-component"],
      });
      expect(created.jsDependencies).toEqual(["slick-carousel"]);
      expect(created.tokenReferences).toEqual(["color-primary-500"]);
      expect(created.relatedComponentIds).toEqual(["badge-component"]);
    });

    it("findCurrentByRecordId / findCurrentByPublicId return null for an unknown id", async () => {
      expect(await patterns.findCurrentByRecordId(randomUUID())).toBeNull();
      expect(await patterns.findCurrentByPublicId("SPL-does-not-exist")).toBeNull();
    });

    it("findCurrentByRecordId / findCurrentByPublicId find a real created record", async () => {
      const publicId = uniqueId("SPL-LEAD");
      const created = await patterns.create({
        publicId,
        patternType: "lead_capture",
        name: "Lead capture form",
        htmlStructure: "<form>...</form>",
      });
      expect((await patterns.findCurrentByRecordId(created.recordId))?.id).toBe(created.id);
      expect((await patterns.findCurrentByPublicId(publicId))?.id).toBe(created.id);
    });

    it("list() filters by patternType/approvalStatus/search (case-insensitive) and only returns isCurrent rows", async () => {
      const uniqueName = uniqueId("Unique Searchable Pattern Name");
      await patterns.create({
        publicId: uniqueId("SPL-ARTICLE"),
        patternType: "article",
        name: uniqueName,
      });

      const byType = await patterns.list({ patternType: "article" });
      expect(byType.length).toBeGreaterThanOrEqual(1);
      expect(byType.every((r) => r.patternType === "article")).toBe(true);

      const byStatus = await patterns.list({ approvalStatus: "draft" });
      expect(byStatus.length).toBeGreaterThanOrEqual(1);

      const bySearch = await patterns.list({ search: uniqueName.toLowerCase() });
      expect(bySearch.length).toBe(1);
    });

    it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
      const uniqueSuffix = uniqueId("PCT");
      const wildcardMatch = await patterns.create({
        publicId: uniqueId("SPL-PCT"),
        patternType: "results_metrics",
        name: `50% Off Pattern ${uniqueSuffix}`,
      });
      const plainMatch = await patterns.create({
        publicId: uniqueId("SPL-PCT"),
        patternType: "results_metrics",
        name: `50X Off Pattern ${uniqueSuffix}`,
      });

      const found = await patterns.list({ search: `50% Off Pattern ${uniqueSuffix}` });
      const ids = found.map((r) => r.id);
      expect(ids).toContain(wildcardMatch.id);
      expect(ids).not.toContain(plainMatch.id);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await patterns.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("updateInPlace() changes fields and never touches approvalStatus/patternType", async () => {
      const created = await patterns.create({
        publicId: uniqueId("SPL-DOWNLOAD"),
        patternType: "download",
        name: "Original",
      });

      const updated = await patterns.updateInPlace(created.id, { name: "Renamed" });
      expect(updated?.name).toBe("Renamed");
      expect(updated?.approvalStatus).toBe("draft");
      expect(updated?.patternType).toBe("download");
    });

    it("updateInPlace() returns null for a missing row id", async () => {
      expect(await patterns.updateInPlace(randomUUID(), { name: "x" })).toBeNull();
    });

    it("updateInPlace() clears jsDependencies to [] on an explicit null, without throwing (regression: spreading a raw null would crash)", async () => {
      const created = await patterns.create({
        publicId: uniqueId("SPL-DEPS"),
        patternType: "multi_step_form",
        name: "Multi-step form",
        jsDependencies: ["formik"],
      });

      const updated = await patterns.updateInPlace(created.id, { jsDependencies: null });
      expect(updated?.jsDependencies).toEqual([]);
    });

    it("updateInPlace() leaves jsDependencies untouched when omitted from the patch", async () => {
      const created = await patterns.create({
        publicId: uniqueId("SPL-DEPS-2"),
        patternType: "multi_step_form",
        name: "Multi-step form 2",
        jsDependencies: ["formik"],
      });

      const updated = await patterns.updateInPlace(created.id, { name: "Renamed" });
      expect(updated?.jsDependencies).toEqual(["formik"]);
    });

    it("updateApprovalStatus() changes approvalStatus when the expected current status matches", async () => {
      const created = await patterns.create({
        publicId: uniqueId("SPL-SEARCH"),
        patternType: "search_filter",
        name: "Status Fixture",
      });
      const result = await patterns.updateApprovalStatus(created.id, "draft", "submitted", null);
      expect(result.outcome).toBe("updated");
      expect(result.outcome === "updated" && result.entity.approvalStatus).toBe("submitted");
    });

    it("updateApprovalStatus() reports not_found for a missing row id", async () => {
      const result = await patterns.updateApprovalStatus(randomUUID(), "draft", "submitted", null);
      expect(result.outcome).toBe("not_found");
    });

    it("updateApprovalStatus() reports conflict (and does not write) on the atomic compare-and-swap", async () => {
      const created = await patterns.create({
        publicId: uniqueId("SPL-CROSSSELL"),
        patternType: "cross_sell",
        name: "Conflict Fixture",
      });
      // The row is really `draft`; we claim we expected `submitted` — a stale read.
      const result = await patterns.updateApprovalStatus(
        created.id,
        "submitted",
        "under_review",
        null,
      );
      expect(result.outcome).toBe("conflict");
      expect(result.outcome === "conflict" && result.entity.approvalStatus).toBe("draft");

      const stillDraft = await patterns.findCurrentByRecordId(created.recordId);
      expect(stillDraft?.approvalStatus).toBe("draft");
    });

    it("rejects an invalid approvalStatus at the database layer (real ENUM constraint)", async () => {
      const created = await patterns.create({
        publicId: uniqueId("SPL-ERR"),
        patternType: "error_no_results",
        name: "Enum Fixture",
      });
      await expect(
        // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
        patterns.updateApprovalStatus(created.id, "draft", "not_a_real_status", null),
      ).rejects.toThrow();
    });

    it("rejects an invalid patternType at the database layer (real ENUM constraint)", async () => {
      await expect(
        patterns.create({
          publicId: uniqueId("SPL-BAD"),
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          patternType: "not_a_real_pattern",
          name: "Enum Fixture 2",
        }),
      ).rejects.toThrow();
    });
  });

  describe("partial-unique-index behavior (WHERE is_current = true)", () => {
    it("rejects a second DIFFERENT record reusing the same publicId while both are current", async () => {
      const publicId = uniqueId("SPL-DUP");
      await patterns.create({ publicId, patternType: "objection_handling", name: "First record" });
      await expect(
        patterns.create({ publicId, patternType: "objection_handling", name: "Second record" }),
      ).rejects.toThrow();
    });

    it("allows creating a new VERSION of the same record that legitimately repeats the same publicId, once the old row's isCurrent is flipped false first", async () => {
      const publicId = uniqueId("SPL-VER");
      const v1 = await patterns.create({
        publicId,
        patternType: "portfolio_showcase",
        name: "V1",
      });

      await withTransaction(async (transaction) => {
        await patterns.updateInPlace(v1.id, { isCurrent: false }, transaction);
        await patterns.createNewVersion(
          {
            recordId: v1.recordId,
            publicId,
            patternType: "portfolio_showcase",
            versionNumber: 2,
            name: "V2",
            description: null,
            designReference: null,
            htmlStructure: null,
            phpPath: null,
            scssReference: null,
            jsDependencies: [],
            responsiveBehavior: null,
            accessibilityNotes: null,
            browserSupport: null,
            tokenReferences: [],
            relatedComponentIds: [],
          },
          transaction,
        );
      });

      const current = await patterns.findCurrentByPublicId(publicId);
      expect(current?.name).toBe("V2");
      expect(current?.versionNumber).toBe(2);

      const allVersions = await patterns.listVersions(v1.recordId);
      expect(allVersions.length).toBe(2);
    });

    it("rejects two versions of the SAME record sharing the same versionNumber ((record_id, version_number) unique index)", async () => {
      const created = await patterns.create({
        publicId: uniqueId("SPL-DUPVER"),
        patternType: "social_proof",
        name: "V1",
      });
      // versionNumber 1 already exists for this recordId (the row just created above) — a second
      // row claiming versionNumber 1 for the same recordId must be rejected.
      await expect(
        patterns.createNewVersion({
          recordId: created.recordId,
          publicId: uniqueId("SPL-DUPVER-2"),
          patternType: "social_proof",
          versionNumber: 1,
          name: "Duplicate version number",
          description: null,
          designReference: null,
          htmlStructure: null,
          phpPath: null,
          scssReference: null,
          jsDependencies: [],
          responsiveBehavior: null,
          accessibilityNotes: null,
          browserSupport: null,
          tokenReferences: [],
          relatedComponentIds: [],
        }),
      ).rejects.toThrow();
    });
  });

  describe("full real end-to-end version-history round trip", () => {
    it("create -> approve -> edit-the-approved-one -> verify 2 rows -> approve the new one -> verify the old row is superseded", async () => {
      const publicId = uniqueId("SPL-E2E");
      const v1 = await patterns.create({
        publicId,
        patternType: "engagement_models",
        name: "Engagement V1",
      });
      expect(v1.approvalStatus).toBe("draft");
      expect(v1.versionNumber).toBe(1);

      // Approve v1.
      const v1Approved = await patterns.updateApprovalStatus(v1.id, "draft", "approved", null);
      expect(v1Approved.outcome).toBe("updated");
      expect(v1Approved.outcome === "updated" && v1Approved.entity.approvalStatus).toBe("approved");

      // Editing an APPROVED current version creates a new version (the service layer's own
      // real behavior, exercised here directly at the repository layer the same way
      // SectionPatternsService.update() composes it).
      const v2 = await withTransaction(async (transaction) => {
        await patterns.updateInPlace(v1.id, { isCurrent: false }, transaction);
        return patterns.createNewVersion(
          {
            recordId: v1.recordId,
            publicId,
            patternType: "engagement_models",
            versionNumber: 2,
            name: "Engagement V2 (revised)",
            description: null,
            designReference: null,
            htmlStructure: null,
            phpPath: null,
            scssReference: null,
            jsDependencies: [],
            responsiveBehavior: null,
            accessibilityNotes: null,
            browserSupport: null,
            tokenReferences: [],
            relatedComponentIds: [],
          },
          transaction,
        );
      });
      expect(v2.approvalStatus).toBe("draft");
      expect(v2.versionNumber).toBe(2);
      expect(v2.isCurrent).toBe(true);

      // Exactly 2 rows now exist for this record.
      const allVersions = await patterns.listVersions(v1.recordId);
      expect(allVersions.length).toBe(2);

      // v1 is no longer current, but it is STILL approved (nothing has superseded it yet) —
      // "preserve versions" holds: it's still readable, not deleted.
      const v1AfterFlip = allVersions.find((r) => r.id === v1.id);
      expect(v1AfterFlip?.isCurrent).toBe(false);
      expect(v1AfterFlip?.approvalStatus).toBe("approved");

      // Approve v2 — the SAME transaction that approves v2 also supersedes v1, mirroring
      // SectionPatternsService.changeApprovalStatus()'s own composition.
      await withTransaction(async (transaction) => {
        const casResult = await patterns.updateApprovalStatus(
          v2.id,
          "draft",
          "approved",
          null,
          transaction,
        );
        expect(casResult.outcome).toBe("updated");
        await patterns.supersedeOtherApprovedVersion(v1.recordId, v2.id, null, transaction);
      });

      const finalVersions = await patterns.listVersions(v1.recordId);
      const finalV1 = finalVersions.find((r) => r.id === v1.id);
      const finalV2 = finalVersions.find((r) => r.id === v2.id);
      expect(finalV1?.approvalStatus).toBe("superseded");
      expect(finalV2?.approvalStatus).toBe("approved");
      expect(finalV2?.isCurrent).toBe(true);
      expect(finalV1?.isCurrent).toBe(false);

      // The current version resolves to v2.
      const current = await patterns.findCurrentByRecordId(v1.recordId);
      expect(current?.id).toBe(v2.id);
    });

    it("supersedeOtherApprovedVersion is a safe no-op when no other approved version exists (a record's first-ever approval)", async () => {
      const created = await patterns.create({
        publicId: uniqueId("SPL-FIRST"),
        patternType: "content_hub",
        name: "First Approval Fixture",
      });
      await withTransaction(async (transaction) => {
        const casResult = await patterns.updateApprovalStatus(
          created.id,
          "draft",
          "approved",
          null,
          transaction,
        );
        expect(casResult.outcome).toBe("updated");
        // No other row exists for this recordId — must not throw.
        await expect(
          patterns.supersedeOtherApprovedVersion(created.recordId, created.id, null, transaction),
        ).resolves.not.toThrow();
      });

      const current = await patterns.findCurrentByRecordId(created.recordId);
      expect(current?.approvalStatus).toBe("approved");
    });
  });

  describe("updateInPlace — CAS guard on approvalStatus", () => {
    it("writes normally when expectedApprovalStatus matches the row's real current status", async () => {
      const created = await patterns.create({
        publicId: uniqueId("SPL-CAS-OK"),
        patternType: "team_expertise",
        name: "CAS guard fixture",
      });

      const updated = await patterns.updateInPlace(
        created.id,
        { name: "Renamed via matching CAS" },
        undefined,
        "draft",
      );

      expect(updated?.name).toBe("Renamed via matching CAS");
    });

    it("is a real, DB-enforced no-op (returns null, writes nothing) when expectedApprovalStatus no longer matches the row's real current status", async () => {
      const created = await patterns.create({
        publicId: uniqueId("SPL-CAS-RACE"),
        patternType: "location",
        name: "Original name",
      });
      // Simulate a concurrent approval landing between a caller's read and its write.
      const approved = await patterns.updateApprovalStatus(created.id, "draft", "approved", null);
      expect(approved.outcome).toBe("updated");

      // The caller still believes the row is "draft" (a stale read) and tries to edit it in place.
      const result = await patterns.updateInPlace(
        created.id,
        { name: "Should never land" },
        undefined,
        "draft",
      );

      expect(result).toBeNull();
      const stillApproved = await patterns.findCurrentByRecordId(created.recordId);
      expect(stillApproved?.name).toBe("Original name");
      expect(stillApproved?.approvalStatus).toBe("approved");
    });
  });

  it("cascades no rows on delete (no hard-delete exists — a real DELETE at the SQL layer removes only the targeted row, proving no unintended FK/cascade side effect exists on this single-table schema)", async () => {
    const created = await patterns.create({
      publicId: uniqueId("SPL-DEL"),
      patternType: "industry",
      name: "Delete Fixture",
    });
    await getConnection().query("DELETE FROM section_pattern_records WHERE id = :id", {
      replacements: { id: created.id },
    });
    expect(await patterns.findCurrentByRecordId(created.recordId)).toBeNull();
  });
});
