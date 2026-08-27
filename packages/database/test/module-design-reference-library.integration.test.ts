import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DesignReferenceRecordRepository } from "../src/design-reference-library/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Design Reference Library schema (migration `00072`) against a REAL, disposable
 * PostgreSQL database. Mirrors ../test/module-brand-library.integration.test.ts's own structure,
 * including dedicated coverage for the two atomic compare-and-swap methods
 * (`updateApprovalStatus()`, `updatePublishState()`) under genuinely concurrent writes, and the
 * `publishedAt` stamp-once contract.
 */
describe("Design Reference Library module (real disposable database)", () => {
  const records = new DesignReferenceRecordRepository();

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

  describe("DesignReferenceRecordRepository", () => {
    it("creates a design reference record defaulting to draft approvalStatus, version 1, unpublished, empty tags", async () => {
      const created = await records.create({
        publicId: uniqueId("DESIGN"),
        title: "Primary Landing Hero",
      });
      expect(created.approvalStatus).toBe("draft");
      expect(created.version).toBe(1);
      expect(created.isPublished).toBe(false);
      expect(created.publishedAt).toBeNull();
      expect(created.sourceUrl).toBeNull();
      expect(created.screenshotUrl).toBeNull();
      expect(created.tags).toEqual([]);
    });

    it("round-trips every scalar content field, including tags", async () => {
      const created = await records.create({
        publicId: uniqueId("DESIGN"),
        title: "Checkout Flow Step 2",
        sourceUrl: "https://example.com/checkout",
        screenshotUrl: "https://example.com/screenshots/checkout-step2.png",
        pageSectionType: "checkout",
        likes: "Clean use of whitespace",
        dislikes: "CTA buried below the fold",
        desktopBehavior: "Sticky header on scroll",
        mobileBehavior: "Collapses to accordion",
        motionNotes: "Subtle fade on step transition",
        accessibilityConcerns: "Low contrast on secondary button",
        performanceConcerns: "Large hero image, no lazy load",
        tags: ["checkout", "ecommerce"],
      });
      const found = await records.findById(created.id);
      expect(found?.sourceUrl).toBe("https://example.com/checkout");
      expect(found?.screenshotUrl).toBe("https://example.com/screenshots/checkout-step2.png");
      expect(found?.pageSectionType).toBe("checkout");
      expect(found?.likes).toBe("Clean use of whitespace");
      expect(found?.dislikes).toBe("CTA buried below the fold");
      expect(found?.desktopBehavior).toBe("Sticky header on scroll");
      expect(found?.mobileBehavior).toBe("Collapses to accordion");
      expect(found?.motionNotes).toBe("Subtle fade on step transition");
      expect(found?.accessibilityConcerns).toBe("Low contrast on secondary button");
      expect(found?.performanceConcerns).toBe("Large hero image, no lazy load");
      expect(found?.tags).toEqual(["checkout", "ecommerce"]);
    });

    it("rejects a duplicate publicId at the database layer", async () => {
      const publicId = uniqueId("DESIGN");
      await records.create({ publicId, title: "First" });
      await expect(records.create({ publicId, title: "Second" })).rejects.toThrow();
    });

    it("finds by publicId, and returns null for a missing one", async () => {
      const publicId = uniqueId("DESIGN");
      const created = await records.create({ publicId, title: "X" });
      expect((await records.findByPublicId(publicId))?.id).toBe(created.id);
      expect(await records.findByPublicId("DESIGN-does-not-exist")).toBeNull();
    });

    it("findById returns null for a missing design reference record", async () => {
      expect(await records.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("list() filters by approvalStatus, isPublished, and search (case-insensitive)", async () => {
      const uniqueTitle = uniqueId("Unique Searchable Title");
      await records.create({ publicId: uniqueId("DESIGN"), title: uniqueTitle });

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
        publicId: uniqueId("DESIGN"),
        title: `50% Off Hero ${uniqueSuffix}`,
      });
      const plainMatch = await records.create({
        publicId: uniqueId("DESIGN"),
        title: `50X Off Hero ${uniqueSuffix}`,
      });

      const result = await records.list({ search: `50% Off Hero ${uniqueSuffix}` });
      const ids = result.map((r) => r.id);
      expect(ids).toContain(wildcardMatch.id);
      expect(ids).not.toContain(plainMatch.id);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await records.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("update() changes content fields, increments version by exactly 1, and never touches approvalStatus/isPublished/publishedAt", async () => {
      const created = await records.create({
        publicId: uniqueId("DESIGN"),
        title: "Original",
      });
      expect(created.version).toBe(1);

      const updated = await records.update(created.id, { title: "Renamed" });
      expect(updated?.title).toBe("Renamed");
      expect(updated?.approvalStatus).toBe("draft");
      expect(updated?.isPublished).toBe(false);
      expect(updated?.publishedAt).toBeNull();
      expect(updated?.version).toBe(2);

      const updatedAgain = await records.update(created.id, { title: "Renamed Again" });
      expect(updatedAgain?.version).toBe(3);
    });

    it("update()'s optional expectedApprovalStatus guard rejects (returns null) a stale-status write and leaves the row untouched", async () => {
      const created = await records.create({
        publicId: uniqueId("DESIGN"),
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
        publicId: uniqueId("DESIGN"),
        title: "CAS Guard Match Fixture",
      });

      const result = await records.update(created.id, { title: "Renamed" }, "draft");
      expect(result?.title).toBe("Renamed");
      expect(result?.version).toBe(2);
    });

    it("update() with concurrent-style repeated calls still increments version atomically (no lost updates)", async () => {
      const created = await records.create({
        publicId: uniqueId("DESIGN"),
        title: "Concurrency Fixture",
      });

      await Promise.all([
        records.update(created.id, { likes: "A" }),
        records.update(created.id, { likes: "B" }),
        records.update(created.id, { likes: "C" }),
      ]);

      const final = await records.findById(created.id);
      expect(final?.version).toBe(4); // 1 (create) + 3 concurrent updates
    });

    it("update() returns null for a missing design reference record", async () => {
      expect(
        await records.update("00000000-0000-4000-8000-000000000000", { title: "x" }),
      ).toBeNull();
    });

    it("update() stores an explicit null on a nullable text field directly, distinct from leaving it untouched", async () => {
      const created = await records.create({
        publicId: uniqueId("DESIGN"),
        title: "Clearing Fixture",
        likes: "Some likes",
        dislikes: "Some dislikes",
      });

      const updated = await records.update(created.id, { likes: null });
      expect(updated?.likes).toBeNull();
      expect(updated?.dislikes).toBe("Some dislikes");
    });

    describe("updateApprovalStatus() — atomic compare-and-swap", () => {
      it("changes approvalStatus when the expected current status matches, and does not touch version", async () => {
        const created = await records.create({
          publicId: uniqueId("DESIGN"),
          title: "Status Fixture",
        });
        const result = await records.updateApprovalStatus(created.id, "draft", "submitted", null);
        expect(result.outcome).toBe("updated");
        expect(result.outcome === "updated" && result.entity.approvalStatus).toBe("submitted");
        expect(result.outcome === "updated" && result.entity.version).toBe(1);
      });

      it("reports not_found for a missing design reference record", async () => {
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
          publicId: uniqueId("DESIGN"),
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
          publicId: uniqueId("DESIGN"),
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
          publicId: uniqueId("DESIGN"),
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
          publicId: uniqueId("DESIGN"),
          title: "Publish Fixture",
        });
        const result = await records.updatePublishState(created.id, false, true, null);
        expect(result.outcome).toBe("updated");
        expect(result.outcome === "updated" && result.entity.isPublished).toBe(true);
        expect(result.outcome === "updated" && result.entity.publishedAt).not.toBeNull();
      });

      it("unpublishes (true -> false), leaving publishedAt untouched", async () => {
        const created = await records.create({
          publicId: uniqueId("DESIGN"),
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
          publicId: uniqueId("DESIGN"),
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

      it("reports not_found for a missing design reference record", async () => {
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
          publicId: uniqueId("DESIGN"),
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
          publicId: uniqueId("DESIGN"),
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
          publicId: uniqueId("DESIGN"),
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
