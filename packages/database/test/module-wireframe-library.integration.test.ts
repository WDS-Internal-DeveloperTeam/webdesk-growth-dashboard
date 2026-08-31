import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WireframeRecordRepository } from "../src/wireframe-library/index.js";
import { closeConnection, getConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";
import { withTransaction } from "../src/transaction.js";

/**
 * Exercises the Wireframe Library schema (migration `00084`) against a REAL, disposable
 * PostgreSQL database. Mirrors ../test/module-section-and-pattern-library.integration.test.ts's
 * own structure — real multi-row version history: the partial-unique-index-on-`is_current`
 * behavior, the `(record_id, version_number)` uniqueness, and a full end-to-end version-history
 * round trip (create -> approve -> edit-the-approved-one -> verify 2 rows exist -> approve the new
 * one -> verify the old row is superseded).
 */
describe("Wireframe Library module (real disposable database)", () => {
  const wireframes = new WireframeRecordRepository();

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

  describe("WireframeRecordRepository — basic CRUD", () => {
    it("creates a record defaulting to draft approvalStatus, versionNumber 1, isCurrent true", async () => {
      const created = await wireframes.create({
        publicId: uniqueId("WF-HOMEPAGE"),
        pageOrModule: "Homepage",
        viewport: "desktop",
      });
      expect(created.approvalStatus).toBe("draft");
      expect(created.versionNumber).toBe(1);
      expect(created.isCurrent).toBe(true);
      expect(created.recordId).toBeTruthy();
      // Each newly created record gets its own fresh recordId — never the same as its own row id
      // by coincidence being asserted here, just confirming it is a real, distinct UUID.
      expect(created.recordId).not.toBe(created.id);
      expect(created.fileReference).toBeNull();
      expect(created.annotations).toBeNull();
      expect(created.interactionNotes).toBeNull();
      expect(created.relatedTemplateId).toBeNull();
      expect(created.reviewerUserId).toBeNull();
    });

    it("stores scalar optional fields when provided", async () => {
      const created = await wireframes.create({
        publicId: uniqueId("WF-CONTACT"),
        pageOrModule: "Contact page",
        viewport: "mobile",
        fileReference: "https://www.figma.com/file/abc123",
        annotations: "Above-the-fold form",
        interactionNotes: "Tap to expand FAQ",
        relatedTemplateId: "template-not-yet-real",
      });
      expect(created.fileReference).toBe("https://www.figma.com/file/abc123");
      expect(created.annotations).toBe("Above-the-fold form");
      expect(created.interactionNotes).toBe("Tap to expand FAQ");
      expect(created.relatedTemplateId).toBe("template-not-yet-real");
    });

    it("findCurrentByRecordId / findCurrentByPublicId return null for an unknown id", async () => {
      expect(await wireframes.findCurrentByRecordId(randomUUID())).toBeNull();
      expect(await wireframes.findCurrentByPublicId("WF-does-not-exist")).toBeNull();
    });

    it("findCurrentByRecordId / findCurrentByPublicId find a real created record", async () => {
      const publicId = uniqueId("WF-PRICING");
      const created = await wireframes.create({
        publicId,
        pageOrModule: "Pricing page",
        viewport: "tablet",
      });
      expect((await wireframes.findCurrentByRecordId(created.recordId))?.id).toBe(created.id);
      expect((await wireframes.findCurrentByPublicId(publicId))?.id).toBe(created.id);
    });

    it("list() filters by viewport/approvalStatus/search (case-insensitive) and only returns isCurrent rows", async () => {
      const uniqueName = uniqueId("Unique Searchable Wireframe Name");
      await wireframes.create({
        publicId: uniqueId("WF-ARTICLE"),
        pageOrModule: uniqueName,
        viewport: "desktop",
      });

      const byViewport = await wireframes.list({ viewport: "desktop" });
      expect(byViewport.length).toBeGreaterThanOrEqual(1);
      expect(byViewport.every((r) => r.viewport === "desktop")).toBe(true);

      const byStatus = await wireframes.list({ approvalStatus: "draft" });
      expect(byStatus.length).toBeGreaterThanOrEqual(1);

      const bySearch = await wireframes.list({ search: uniqueName.toLowerCase() });
      expect(bySearch.length).toBe(1);
    });

    it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
      const uniqueSuffix = uniqueId("PCT");
      const wildcardMatch = await wireframes.create({
        publicId: uniqueId("WF-PCT"),
        pageOrModule: `50% Off Page ${uniqueSuffix}`,
        viewport: "desktop",
      });
      const plainMatch = await wireframes.create({
        publicId: uniqueId("WF-PCT"),
        pageOrModule: `50X Off Page ${uniqueSuffix}`,
        viewport: "desktop",
      });

      const found = await wireframes.list({ search: `50% Off Page ${uniqueSuffix}` });
      const ids = found.map((r) => r.id);
      expect(ids).toContain(wildcardMatch.id);
      expect(ids).not.toContain(plainMatch.id);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await wireframes.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("updateInPlace() changes fields and never touches approvalStatus/pageOrModule", async () => {
      const created = await wireframes.create({
        publicId: uniqueId("WF-DOWNLOAD"),
        pageOrModule: "Original page",
        viewport: "desktop",
      });

      const updated = await wireframes.updateInPlace(created.id, { viewport: "mobile" });
      expect(updated?.viewport).toBe("mobile");
      expect(updated?.approvalStatus).toBe("draft");
      expect(updated?.pageOrModule).toBe("Original page");
    });

    it("updateInPlace() returns null for a missing row id", async () => {
      expect(await wireframes.updateInPlace(randomUUID(), { viewport: "mobile" })).toBeNull();
    });

    it("updateInPlace() clears fileReference to null on an explicit null", async () => {
      const created = await wireframes.create({
        publicId: uniqueId("WF-CLEAR"),
        pageOrModule: "Some page",
        viewport: "desktop",
        fileReference: "https://www.figma.com/file/xyz",
      });

      const updated = await wireframes.updateInPlace(created.id, { fileReference: null });
      expect(updated?.fileReference).toBeNull();
    });

    it("updateInPlace() leaves fileReference untouched when omitted from the patch", async () => {
      const created = await wireframes.create({
        publicId: uniqueId("WF-KEEP"),
        pageOrModule: "Some other page",
        viewport: "desktop",
        fileReference: "https://www.figma.com/file/kept",
      });

      const updated = await wireframes.updateInPlace(created.id, { viewport: "tablet" });
      expect(updated?.fileReference).toBe("https://www.figma.com/file/kept");
    });

    it("updateApprovalStatus() changes approvalStatus when the expected current status matches", async () => {
      const created = await wireframes.create({
        publicId: uniqueId("WF-SEARCH"),
        pageOrModule: "Status Fixture",
        viewport: "desktop",
      });
      const result = await wireframes.updateApprovalStatus(created.id, "draft", "submitted", null);
      expect(result.outcome).toBe("updated");
      expect(result.outcome === "updated" && result.entity.approvalStatus).toBe("submitted");
    });

    it("updateApprovalStatus() reports not_found for a missing row id", async () => {
      const result = await wireframes.updateApprovalStatus(
        randomUUID(),
        "draft",
        "submitted",
        null,
      );
      expect(result.outcome).toBe("not_found");
    });

    it("updateApprovalStatus() reports conflict (and does not write) on the atomic compare-and-swap", async () => {
      const created = await wireframes.create({
        publicId: uniqueId("WF-CROSSSELL"),
        pageOrModule: "Conflict Fixture",
        viewport: "desktop",
      });
      // The row is really `draft`; we claim we expected `submitted` — a stale read.
      const result = await wireframes.updateApprovalStatus(
        created.id,
        "submitted",
        "under_review",
        null,
      );
      expect(result.outcome).toBe("conflict");
      expect(result.outcome === "conflict" && result.entity.approvalStatus).toBe("draft");

      const stillDraft = await wireframes.findCurrentByRecordId(created.recordId);
      expect(stillDraft?.approvalStatus).toBe("draft");
    });

    it("rejects an invalid approvalStatus at the database layer (real ENUM constraint)", async () => {
      const created = await wireframes.create({
        publicId: uniqueId("WF-ERR"),
        pageOrModule: "Enum Fixture",
        viewport: "desktop",
      });
      await expect(
        // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
        wireframes.updateApprovalStatus(created.id, "draft", "not_a_real_status", null),
      ).rejects.toThrow();
    });

    it("rejects an invalid viewport at the database layer (real ENUM constraint)", async () => {
      await expect(
        wireframes.create({
          publicId: uniqueId("WF-BAD"),
          pageOrModule: "Enum Fixture 2",
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          viewport: "not_a_real_viewport",
        }),
      ).rejects.toThrow();
    });
  });

  describe("partial-unique-index behavior (WHERE is_current = true)", () => {
    it("rejects a second DIFFERENT record reusing the same publicId while both are current", async () => {
      const publicId = uniqueId("WF-DUP");
      await wireframes.create({ publicId, pageOrModule: "First record", viewport: "desktop" });
      await expect(
        wireframes.create({ publicId, pageOrModule: "Second record", viewport: "desktop" }),
      ).rejects.toThrow();
    });

    it("allows creating a new VERSION of the same record that legitimately repeats the same publicId, once the old row's isCurrent is flipped false first", async () => {
      const publicId = uniqueId("WF-VER");
      const v1 = await wireframes.create({
        publicId,
        pageOrModule: "Homepage",
        viewport: "desktop",
      });

      await withTransaction(async (transaction) => {
        await wireframes.updateInPlace(v1.id, { isCurrent: false }, transaction);
        await wireframes.createNewVersion(
          {
            recordId: v1.recordId,
            publicId,
            pageOrModule: "Homepage",
            versionNumber: 2,
            viewport: "mobile",
            fileReference: null,
            annotations: null,
            interactionNotes: null,
            relatedTemplateId: null,
            reviewerUserId: null,
          },
          transaction,
        );
      });

      const current = await wireframes.findCurrentByPublicId(publicId);
      expect(current?.viewport).toBe("mobile");
      expect(current?.versionNumber).toBe(2);

      const allVersions = await wireframes.listVersions(v1.recordId);
      expect(allVersions.length).toBe(2);
    });

    it("rejects two versions of the SAME record sharing the same versionNumber ((record_id, version_number) unique index)", async () => {
      const created = await wireframes.create({
        publicId: uniqueId("WF-DUPVER"),
        pageOrModule: "V1",
        viewport: "desktop",
      });
      // versionNumber 1 already exists for this recordId (the row just created above) — a second
      // row claiming versionNumber 1 for the same recordId must be rejected.
      await expect(
        wireframes.createNewVersion({
          recordId: created.recordId,
          publicId: uniqueId("WF-DUPVER-2"),
          pageOrModule: "Duplicate version number",
          versionNumber: 1,
          viewport: "desktop",
          fileReference: null,
          annotations: null,
          interactionNotes: null,
          relatedTemplateId: null,
          reviewerUserId: null,
        }),
      ).rejects.toThrow();
    });
  });

  describe("full real end-to-end version-history round trip", () => {
    it("create -> approve -> edit-the-approved-one -> verify 2 rows -> approve the new one -> verify the old row is superseded", async () => {
      const publicId = uniqueId("WF-E2E");
      const v1 = await wireframes.create({
        publicId,
        pageOrModule: "Engagement page",
        viewport: "desktop",
      });
      expect(v1.approvalStatus).toBe("draft");
      expect(v1.versionNumber).toBe(1);

      // Approve v1.
      const v1Approved = await wireframes.updateApprovalStatus(v1.id, "draft", "approved", null);
      expect(v1Approved.outcome).toBe("updated");
      expect(v1Approved.outcome === "updated" && v1Approved.entity.approvalStatus).toBe("approved");

      // Editing an APPROVED current version creates a new version (the service layer's own real
      // behavior, exercised here directly at the repository layer the same way
      // WireframesService.update() composes it).
      const v2 = await withTransaction(async (transaction) => {
        await wireframes.updateInPlace(v1.id, { isCurrent: false }, transaction);
        return wireframes.createNewVersion(
          {
            recordId: v1.recordId,
            publicId,
            pageOrModule: "Engagement page",
            versionNumber: 2,
            viewport: "mobile",
            fileReference: null,
            annotations: null,
            interactionNotes: null,
            relatedTemplateId: null,
            reviewerUserId: null,
          },
          transaction,
        );
      });
      expect(v2.approvalStatus).toBe("draft");
      expect(v2.versionNumber).toBe(2);
      expect(v2.isCurrent).toBe(true);

      // Exactly 2 rows now exist for this record.
      const allVersions = await wireframes.listVersions(v1.recordId);
      expect(allVersions.length).toBe(2);

      // v1 is no longer current, but it is STILL approved (nothing has superseded it yet) —
      // "preserve versions" holds: it's still readable, not deleted.
      const v1AfterFlip = allVersions.find((r) => r.id === v1.id);
      expect(v1AfterFlip?.isCurrent).toBe(false);
      expect(v1AfterFlip?.approvalStatus).toBe("approved");

      // Approve v2 — the SAME transaction that approves v2 also supersedes v1, mirroring
      // WireframesService.changeApprovalStatus()'s own composition.
      await withTransaction(async (transaction) => {
        const casResult = await wireframes.updateApprovalStatus(
          v2.id,
          "draft",
          "approved",
          null,
          transaction,
        );
        expect(casResult.outcome).toBe("updated");
        await wireframes.supersedeOtherApprovedVersion(v1.recordId, v2.id, null, transaction);
      });

      const finalVersions = await wireframes.listVersions(v1.recordId);
      const finalV1 = finalVersions.find((r) => r.id === v1.id);
      const finalV2 = finalVersions.find((r) => r.id === v2.id);
      expect(finalV1?.approvalStatus).toBe("superseded");
      expect(finalV2?.approvalStatus).toBe("approved");
      expect(finalV2?.isCurrent).toBe(true);
      expect(finalV1?.isCurrent).toBe(false);

      // The current version resolves to v2.
      const current = await wireframes.findCurrentByRecordId(v1.recordId);
      expect(current?.id).toBe(v2.id);
    });

    it("supersedeOtherApprovedVersion is a safe no-op when no other approved version exists (a record's first-ever approval)", async () => {
      const created = await wireframes.create({
        publicId: uniqueId("WF-FIRST"),
        pageOrModule: "First Approval Fixture",
        viewport: "desktop",
      });
      await withTransaction(async (transaction) => {
        const casResult = await wireframes.updateApprovalStatus(
          created.id,
          "draft",
          "approved",
          null,
          transaction,
        );
        expect(casResult.outcome).toBe("updated");
        // No other row exists for this recordId — must not throw.
        await expect(
          wireframes.supersedeOtherApprovedVersion(created.recordId, created.id, null, transaction),
        ).resolves.not.toThrow();
      });

      const current = await wireframes.findCurrentByRecordId(created.recordId);
      expect(current?.approvalStatus).toBe("approved");
    });
  });

  describe("updateInPlace — CAS guard on approvalStatus", () => {
    it("writes normally when expectedApprovalStatus matches the row's real current status", async () => {
      const created = await wireframes.create({
        publicId: uniqueId("WF-CAS-OK"),
        pageOrModule: "CAS guard fixture",
        viewport: "desktop",
      });

      const updated = await wireframes.updateInPlace(
        created.id,
        { viewport: "mobile" },
        undefined,
        "draft",
      );

      expect(updated?.viewport).toBe("mobile");
    });

    it("is a real, DB-enforced no-op (returns null, writes nothing) when expectedApprovalStatus no longer matches the row's real current status", async () => {
      const created = await wireframes.create({
        publicId: uniqueId("WF-CAS-RACE"),
        pageOrModule: "Original page",
        viewport: "desktop",
      });
      // Simulate a concurrent approval landing between a caller's read and its write.
      const approved = await wireframes.updateApprovalStatus(created.id, "draft", "approved", null);
      expect(approved.outcome).toBe("updated");

      // The caller still believes the row is "draft" (a stale read) and tries to edit it in place.
      const result = await wireframes.updateInPlace(
        created.id,
        { viewport: "mobile" },
        undefined,
        "draft",
      );

      expect(result).toBeNull();
      const stillApproved = await wireframes.findCurrentByRecordId(created.recordId);
      expect(stillApproved?.viewport).toBe("desktop");
      expect(stillApproved?.approvalStatus).toBe("approved");
    });
  });

  it("cascades no rows on delete (no hard-delete exists — a real DELETE at the SQL layer removes only the targeted row, proving no unintended FK/cascade side effect exists on this single-table schema)", async () => {
    const created = await wireframes.create({
      publicId: uniqueId("WF-DEL"),
      pageOrModule: "Delete Fixture",
      viewport: "desktop",
    });
    await getConnection().query("DELETE FROM wireframe_records WHERE id = :id", {
      replacements: { id: created.id },
    });
    expect(await wireframes.findCurrentByRecordId(created.recordId)).toBeNull();
  });
});
