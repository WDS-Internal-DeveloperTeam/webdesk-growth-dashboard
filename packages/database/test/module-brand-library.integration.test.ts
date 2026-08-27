import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BrandLibraryRecordRepository } from "../src/brand-library/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Brand Library schema (migration `00070`) against a REAL, disposable PostgreSQL
 * database. Mirrors ../test/module-content-template-library.integration.test.ts's own structure,
 * including dedicated coverage for the two atomic compare-and-swap methods
 * (`updateApprovalStatus()`, `updatePublishState()`) under genuinely concurrent writes, and the
 * `publishedAt` stamp-once contract.
 */
describe("Brand Library module (real disposable database)", () => {
  const records = new BrandLibraryRecordRepository();

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

  describe("BrandLibraryRecordRepository", () => {
    it("creates a brand library record defaulting to draft approvalStatus, version 1, unpublished", async () => {
      const created = await records.create({
        publicId: uniqueId("BRAND"),
        recordType: "logo",
        title: "Primary Logo",
      });
      expect(created.approvalStatus).toBe("draft");
      expect(created.version).toBe(1);
      expect(created.isPublished).toBe(false);
      expect(created.publishedAt).toBeNull();
      expect(created.description).toBeNull();
      expect(created.fileReference).toBeNull();
    });

    it("round-trips every scalar content field", async () => {
      const created = await records.create({
        publicId: uniqueId("BRAND"),
        recordType: "color",
        title: "Primary Palette",
        description: "Our primary brand color family",
        fileReference: "https://example.com/brand/colors.pdf",
        usageNotes: "Use #1a2b3c for primary CTAs only",
      });
      const found = await records.findById(created.id);
      expect(found?.description).toBe("Our primary brand color family");
      expect(found?.fileReference).toBe("https://example.com/brand/colors.pdf");
      expect(found?.usageNotes).toBe("Use #1a2b3c for primary CTAs only");
    });

    it("rejects an invalid recordType at the database layer (real ENUM constraint)", async () => {
      await expect(
        records.create({
          publicId: uniqueId("BRAND"),
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          recordType: "not_a_real_type",
          title: "X",
        }),
      ).rejects.toThrow();
    });

    it("rejects a duplicate publicId at the database layer", async () => {
      const publicId = uniqueId("BRAND");
      await records.create({ publicId, recordType: "logo", title: "First" });
      await expect(
        records.create({ publicId, recordType: "logo", title: "Second" }),
      ).rejects.toThrow();
    });

    it("finds by publicId, and returns null for a missing one", async () => {
      const publicId = uniqueId("BRAND");
      const created = await records.create({ publicId, recordType: "logo", title: "X" });
      expect((await records.findByPublicId(publicId))?.id).toBe(created.id);
      expect(await records.findByPublicId("BRAND-does-not-exist")).toBeNull();
    });

    it("findById returns null for a missing brand library record", async () => {
      expect(await records.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("list() filters by recordType, approvalStatus, isPublished, and search (case-insensitive)", async () => {
      const uniqueTitle = uniqueId("Unique Searchable Title");
      await records.create({ publicId: uniqueId("BRAND"), recordType: "tone", title: uniqueTitle });

      const byType = await records.list({ recordType: "tone" });
      expect(byType.length).toBeGreaterThanOrEqual(1);

      const byStatus = await records.list({ approvalStatus: "draft" });
      expect(byStatus.length).toBeGreaterThanOrEqual(1);

      const byPublished = await records.list({ isPublished: false });
      expect(byPublished.length).toBeGreaterThanOrEqual(1);

      const bySearch = await records.list({ search: uniqueTitle.toLowerCase() });
      expect(bySearch.length).toBe(1);
    });

    it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
      const uniqueSuffix = uniqueId("PCT");
      const wildcardMatch = await records.create({
        publicId: uniqueId("BRAND"),
        recordType: "logo",
        title: `50% Off Logo ${uniqueSuffix}`,
      });
      const plainMatch = await records.create({
        publicId: uniqueId("BRAND"),
        recordType: "logo",
        title: `50X Off Logo ${uniqueSuffix}`,
      });

      const result = await records.list({ search: `50% Off Logo ${uniqueSuffix}` });
      const ids = result.map((r) => r.id);
      expect(ids).toContain(wildcardMatch.id);
      expect(ids).not.toContain(plainMatch.id);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await records.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("update() changes content fields, increments version by exactly 1, and never touches approvalStatus/isPublished/publishedAt/recordType", async () => {
      const created = await records.create({
        publicId: uniqueId("BRAND"),
        recordType: "typography",
        title: "Original",
      });
      expect(created.version).toBe(1);

      const updated = await records.update(created.id, { title: "Renamed" });
      expect(updated?.title).toBe("Renamed");
      expect(updated?.recordType).toBe("typography");
      expect(updated?.approvalStatus).toBe("draft");
      expect(updated?.isPublished).toBe(false);
      expect(updated?.publishedAt).toBeNull();
      expect(updated?.version).toBe(2);

      const updatedAgain = await records.update(created.id, { title: "Renamed Again" });
      expect(updatedAgain?.version).toBe(3);
    });

    it("update()'s optional expectedApprovalStatus guard rejects (returns null) a stale-status write and leaves the row untouched", async () => {
      const created = await records.create({
        publicId: uniqueId("BRAND"),
        recordType: "logo",
        title: "CAS Guard Fixture",
      });

      // Claim we expected the row to still be "submitted" when it's really "draft" — a stale read.
      const result = await records.update(created.id, { title: "Should Not Apply" }, "submitted");
      expect(result).toBeNull();

      const stillOriginal = await records.findById(created.id);
      expect(stillOriginal?.title).toBe("CAS Guard Fixture");
      expect(stillOriginal?.version).toBe(1);
    });

    it("update() with the correct expectedApprovalStatus succeeds normally", async () => {
      const created = await records.create({
        publicId: uniqueId("BRAND"),
        recordType: "logo",
        title: "CAS Guard Match Fixture",
      });

      const result = await records.update(created.id, { title: "Renamed" }, "draft");
      expect(result?.title).toBe("Renamed");
      expect(result?.version).toBe(2);
    });

    it("update() with concurrent-style repeated calls still increments version atomically (no lost updates)", async () => {
      const created = await records.create({
        publicId: uniqueId("BRAND"),
        recordType: "logo",
        title: "Concurrency Fixture",
      });

      await Promise.all([
        records.update(created.id, { description: "A" }),
        records.update(created.id, { description: "B" }),
        records.update(created.id, { description: "C" }),
      ]);

      const final = await records.findById(created.id);
      expect(final?.version).toBe(4); // 1 (create) + 3 concurrent updates
    });

    it("update() returns null for a missing brand library record", async () => {
      expect(
        await records.update("00000000-0000-4000-8000-000000000000", { title: "x" }),
      ).toBeNull();
    });

    it("update() stores an explicit null on a nullable text field directly, distinct from leaving it untouched", async () => {
      const created = await records.create({
        publicId: uniqueId("BRAND"),
        recordType: "logo",
        title: "Clearing Fixture",
        description: "Some description",
        usageNotes: "Some usage notes",
      });

      const updated = await records.update(created.id, { description: null });
      expect(updated?.description).toBeNull();
      expect(updated?.usageNotes).toBe("Some usage notes");
    });

    describe("updateApprovalStatus() — atomic compare-and-swap", () => {
      it("changes approvalStatus when the expected current status matches, and does not touch version", async () => {
        const created = await records.create({
          publicId: uniqueId("BRAND"),
          recordType: "logo",
          title: "Status Fixture",
        });
        const result = await records.updateApprovalStatus(created.id, "draft", "submitted", null);
        expect(result.outcome).toBe("updated");
        expect(result.outcome === "updated" && result.entity.approvalStatus).toBe("submitted");
        expect(result.outcome === "updated" && result.entity.version).toBe(1);
      });

      it("reports not_found for a missing brand library record", async () => {
        const result = await records.updateApprovalStatus(
          "00000000-0000-4000-8000-000000000000",
          "draft",
          "submitted",
          null,
        );
        expect(result.outcome).toBe("not_found");
      });

      it("reports conflict (and does not write) on the atomic compare-and-swap", async () => {
        const created = await records.create({
          publicId: uniqueId("BRAND"),
          recordType: "logo",
          title: "Conflict Fixture",
        });
        // The record is really `draft`; claim we expected `submitted` — a stale read.
        const result = await records.updateApprovalStatus(
          created.id,
          "submitted",
          "under_review",
          null,
        );
        expect(result.outcome).toBe("conflict");
        expect(result.outcome === "conflict" && result.entity.approvalStatus).toBe("draft");

        const stillDraft = await records.findById(created.id);
        expect(stillDraft?.approvalStatus).toBe("draft");
      });

      it("under a genuine concurrent race (two simultaneous CAS calls with the same expected status), only one wins", async () => {
        const created = await records.create({
          publicId: uniqueId("BRAND"),
          recordType: "logo",
          title: "Real Race Fixture",
        });

        const [first, second] = await Promise.all([
          records.updateApprovalStatus(created.id, "draft", "submitted", null),
          records.updateApprovalStatus(created.id, "draft", "archived", null),
        ]);

        const outcomes = [first.outcome, second.outcome].sort();
        expect(outcomes).toEqual(["conflict", "updated"]);

        const final = await records.findById(created.id);
        expect(["submitted", "archived"]).toContain(final?.approvalStatus);
      });

      it("rejects an invalid approvalStatus at the database layer (real ENUM constraint)", async () => {
        const created = await records.create({
          publicId: uniqueId("BRAND"),
          recordType: "logo",
          title: "y",
        });
        await expect(
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          records.updateApprovalStatus(created.id, "draft", "not_a_real_status", null),
        ).rejects.toThrow();
      });
    });

    describe("updatePublishState() — atomic compare-and-swap with publishedAt stamp-once", () => {
      it("publishes (false -> true), stamping publishedAt", async () => {
        const created = await records.create({
          publicId: uniqueId("BRAND"),
          recordType: "logo",
          title: "Publish Fixture",
        });
        const result = await records.updatePublishState(created.id, false, true, null);
        expect(result.outcome).toBe("updated");
        expect(result.outcome === "updated" && result.entity.isPublished).toBe(true);
        expect(result.outcome === "updated" && result.entity.publishedAt).not.toBeNull();
      });

      it("unpublishes (true -> false), leaving publishedAt untouched", async () => {
        const created = await records.create({
          publicId: uniqueId("BRAND"),
          recordType: "logo",
          title: "Unpublish Fixture",
        });
        const published = await records.updatePublishState(created.id, false, true, null);
        const publishedAt = published.outcome === "updated" ? published.entity.publishedAt : null;
        expect(publishedAt).not.toBeNull();

        const result = await records.updatePublishState(created.id, true, false, null);
        expect(result.outcome).toBe("updated");
        expect(result.outcome === "updated" && result.entity.isPublished).toBe(false);
        expect(result.outcome === "updated" && result.entity.publishedAt).toBe(publishedAt);
      });

      it("publishedAt is stamped exactly once — an unpublish/republish cycle does NOT reset it to a later time", async () => {
        const created = await records.create({
          publicId: uniqueId("BRAND"),
          recordType: "logo",
          title: "Stamp Once Fixture",
        });
        const firstPublish = await records.updatePublishState(created.id, false, true, null);
        const firstPublishedAt =
          firstPublish.outcome === "updated" ? firstPublish.entity.publishedAt : null;
        expect(firstPublishedAt).not.toBeNull();

        await records.updatePublishState(created.id, true, false, null); // unpublish
        await new Promise((resolve) => setTimeout(resolve, 20));
        const republish = await records.updatePublishState(created.id, false, true, null);

        expect(republish.outcome).toBe("updated");
        expect(republish.outcome === "updated" && republish.entity.publishedAt).toBe(
          firstPublishedAt,
        );
      });

      it("reports not_found for a missing brand library record", async () => {
        const result = await records.updatePublishState(
          "00000000-0000-4000-8000-000000000000",
          false,
          true,
          null,
        );
        expect(result.outcome).toBe("not_found");
      });

      it("reports conflict (and does not write) when the expected isPublished doesn't match — a stale read", async () => {
        const created = await records.create({
          publicId: uniqueId("BRAND"),
          recordType: "logo",
          title: "Publish Conflict Fixture",
        });
        const result = await records.updatePublishState(created.id, true, false, null);
        expect(result.outcome).toBe("conflict");
        expect(result.outcome === "conflict" && result.entity.isPublished).toBe(false);

        const stillUnpublished = await records.findById(created.id);
        expect(stillUnpublished?.isPublished).toBe(false);
      });

      it("under a genuine concurrent race (two simultaneous publish attempts), only one wins and publishedAt is stamped exactly once", async () => {
        const created = await records.create({
          publicId: uniqueId("BRAND"),
          recordType: "logo",
          title: "Real Publish Race Fixture",
        });

        const [first, second] = await Promise.all([
          records.updatePublishState(created.id, false, true, null),
          records.updatePublishState(created.id, false, true, null),
        ]);

        const outcomes = [first.outcome, second.outcome].sort();
        expect(outcomes).toEqual(["conflict", "updated"]);

        const final = await records.findById(created.id);
        expect(final?.isPublished).toBe(true);
        expect(final?.publishedAt).not.toBeNull();
      });

      it("the expectedApprovalStatus CAS guard rejects a publish write once a concurrent status change has already committed — closing the TOCTOU race the guard was added for", async () => {
        const created = await records.create({
          publicId: uniqueId("BRAND"),
          recordType: "logo",
          title: "TOCTOU Guard Fixture",
        });
        const approved = await records.updateApprovalStatus(created.id, "draft", "approved", null);
        expect(approved.outcome).toBe("updated");

        const readAtPublishTime = await records.findById(created.id);
        expect(readAtPublishTime?.approvalStatus).toBe("approved");

        const archived = await records.updateApprovalStatus(
          created.id,
          "approved",
          "archived",
          null,
        );
        expect(archived.outcome).toBe("updated");

        const publishResult = await records.updatePublishState(
          created.id,
          false,
          true,
          null,
          readAtPublishTime!.approvalStatus,
        );
        expect(publishResult.outcome).toBe("conflict");

        const final = await records.findById(created.id);
        expect(final?.approvalStatus).toBe("archived");
        expect(final?.isPublished).toBe(false);
      });
    });
  });
});
