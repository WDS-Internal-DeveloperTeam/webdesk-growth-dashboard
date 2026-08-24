import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ContentTemplateRepository } from "../src/content-template-library/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Content Template Library schema (migration `00064`) against a REAL, disposable
 * PostgreSQL database. Mirrors ../test/module-persona-library.integration.test.ts's own
 * structure, plus dedicated coverage for the two atomic compare-and-swap methods
 * (`updateApprovalStatus()`, `updatePublishState()`) under genuinely concurrent writes, and the
 * `publishedAt` stamp-once contract.
 */
describe("Content Template Library module (real disposable database)", () => {
  const templates = new ContentTemplateRepository();

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

  describe("ContentTemplateRepository", () => {
    it("creates a content template defaulting to draft approvalStatus, version 1, unpublished, null arrays", async () => {
      const created = await templates.create({
        publicId: uniqueId("TEMPLATE"),
        pageType: "Service Page",
      });
      expect(created.approvalStatus).toBe("draft");
      expect(created.version).toBe(1);
      expect(created.isPublished).toBe(false);
      expect(created.publishedAt).toBeNull();
      expect(created.requiredSections).toBeNull();
      expect(created.optionalSections).toBeNull();
    });

    it("round-trips requiredSections/optionalSections array columns", async () => {
      const created = await templates.create({
        publicId: uniqueId("TEMPLATE"),
        pageType: "Blog Post",
        requiredSections: ["Hero", "CTA"],
        optionalSections: ["FAQ"],
      });
      const found = await templates.findById(created.id);
      expect(found?.requiredSections).toEqual(["Hero", "CTA"]);
      expect(found?.optionalSections).toEqual(["FAQ"]);
    });

    it("stores a null array field as null, not an empty array (nullable, unlike Persona Library's NOT NULL columns)", async () => {
      const created = await templates.create({
        publicId: uniqueId("TEMPLATE"),
        pageType: "Landing Page",
        requiredSections: null,
      });
      expect(created.requiredSections).toBeNull();
    });

    it("rejects a duplicate publicId at the database layer", async () => {
      const publicId = uniqueId("TEMPLATE");
      await templates.create({ publicId, pageType: "First" });
      await expect(templates.create({ publicId, pageType: "Second" })).rejects.toThrow();
    });

    it("finds by publicId, and returns null for a missing one", async () => {
      const publicId = uniqueId("TEMPLATE");
      const created = await templates.create({ publicId, pageType: "X" });
      expect((await templates.findByPublicId(publicId))?.id).toBe(created.id);
      expect(await templates.findByPublicId("TEMPLATE-does-not-exist")).toBeNull();
    });

    it("findById returns null for a missing content template", async () => {
      expect(await templates.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("list() filters by approvalStatus, isPublished, and search (case-insensitive)", async () => {
      const uniquePageType = uniqueId("Unique Searchable Page Type");
      await templates.create({ publicId: uniqueId("TEMPLATE"), pageType: uniquePageType });

      const byStatus = await templates.list({ approvalStatus: "draft" });
      expect(byStatus.length).toBeGreaterThanOrEqual(1);

      const byPublished = await templates.list({ isPublished: false });
      expect(byPublished.length).toBeGreaterThanOrEqual(1);

      const bySearch = await templates.list({ search: uniquePageType.toLowerCase() });
      expect(bySearch.length).toBe(1);
    });

    it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
      const uniqueSuffix = uniqueId("PCT");
      const wildcardMatch = await templates.create({
        publicId: uniqueId("TEMPLATE"),
        pageType: `50% Off Page ${uniqueSuffix}`,
      });
      const plainMatch = await templates.create({
        publicId: uniqueId("TEMPLATE"),
        pageType: `50X Off Page ${uniqueSuffix}`,
      });

      const result = await templates.list({ search: `50% Off Page ${uniqueSuffix}` });
      const ids = result.map((t) => t.id);
      expect(ids).toContain(wildcardMatch.id);
      expect(ids).not.toContain(plainMatch.id);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await templates.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("update() changes content fields, increments version by exactly 1, and never touches approvalStatus/isPublished/publishedAt", async () => {
      const created = await templates.create({
        publicId: uniqueId("TEMPLATE"),
        pageType: "Original",
      });
      expect(created.version).toBe(1);

      const updated = await templates.update(created.id, { pageType: "Renamed" });
      expect(updated?.pageType).toBe("Renamed");
      expect(updated?.approvalStatus).toBe("draft");
      expect(updated?.isPublished).toBe(false);
      expect(updated?.publishedAt).toBeNull();
      expect(updated?.version).toBe(2);

      const updatedAgain = await templates.update(created.id, { pageType: "Renamed Again" });
      expect(updatedAgain?.version).toBe(3);
    });

    it("update()'s optional expectedApprovalStatus guard rejects (returns null) a stale-status write and leaves the row untouched", async () => {
      const created = await templates.create({
        publicId: uniqueId("TEMPLATE"),
        pageType: "CAS Guard Fixture",
      });

      // Claim we expected the row to still be "submitted" when it's really "draft" — a stale read.
      const result = await templates.update(
        created.id,
        { pageType: "Should Not Apply" },
        "submitted",
      );
      expect(result).toBeNull();

      const stillOriginal = await templates.findById(created.id);
      expect(stillOriginal?.pageType).toBe("CAS Guard Fixture");
      expect(stillOriginal?.version).toBe(1);
    });

    it("update() with the correct expectedApprovalStatus succeeds normally", async () => {
      const created = await templates.create({
        publicId: uniqueId("TEMPLATE"),
        pageType: "CAS Guard Match Fixture",
      });

      const result = await templates.update(created.id, { pageType: "Renamed" }, "draft");
      expect(result?.pageType).toBe("Renamed");
      expect(result?.version).toBe(2);
    });

    it("update() with concurrent-style repeated calls still increments version atomically (no lost updates)", async () => {
      const created = await templates.create({
        publicId: uniqueId("TEMPLATE"),
        pageType: "Concurrency Fixture",
      });

      // Fire several updates "concurrently" (no await between issuing them) — a naive
      // read-then-write `version: current + 1` would lose increments under this exact shape; the
      // real atomic `UPDATE ... SET version = version + 1` must not.
      await Promise.all([
        templates.update(created.id, { purpose: "A" }),
        templates.update(created.id, { purpose: "B" }),
        templates.update(created.id, { purpose: "C" }),
      ]);

      const final = await templates.findById(created.id);
      expect(final?.version).toBe(4); // 1 (create) + 3 concurrent updates
    });

    it("update() returns null for a missing content template", async () => {
      expect(
        await templates.update("00000000-0000-4000-8000-000000000000", { pageType: "x" }),
      ).toBeNull();
    });

    it("update() stores an explicit null on a nullable array field directly, distinct from leaving it untouched", async () => {
      const created = await templates.create({
        publicId: uniqueId("TEMPLATE"),
        pageType: "Array Clearing Fixture",
        requiredSections: ["Hero"],
        optionalSections: ["FAQ"],
      });

      const updated = await templates.update(created.id, { requiredSections: null });
      expect(updated?.requiredSections).toBeNull();
      expect(updated?.optionalSections).toEqual(["FAQ"]);
    });

    describe("updateApprovalStatus() — atomic compare-and-swap", () => {
      it("changes approvalStatus when the expected current status matches, and does not touch version", async () => {
        const created = await templates.create({
          publicId: uniqueId("TEMPLATE"),
          pageType: "Status Fixture",
        });
        const result = await templates.updateApprovalStatus(created.id, "draft", "submitted", null);
        expect(result.outcome).toBe("updated");
        expect(result.outcome === "updated" && result.entity.approvalStatus).toBe("submitted");
        expect(result.outcome === "updated" && result.entity.version).toBe(1);
      });

      it("reports not_found for a missing content template", async () => {
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
          publicId: uniqueId("TEMPLATE"),
          pageType: "Conflict Fixture",
        });
        // The template is really `draft`; claim we expected `submitted` — a stale read.
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
          publicId: uniqueId("TEMPLATE"),
          pageType: "Real Race Fixture",
        });

        const [first, second] = await Promise.all([
          templates.updateApprovalStatus(created.id, "draft", "submitted", null),
          templates.updateApprovalStatus(created.id, "draft", "archived", null),
        ]);

        const outcomes = [first.outcome, second.outcome].sort();
        expect(outcomes).toEqual(["conflict", "updated"]);

        const final = await templates.findById(created.id);
        // Whichever won, the final state must be exactly one of the two attempted values, never
        // both applied and never left at the original "draft".
        expect(["submitted", "archived"]).toContain(final?.approvalStatus);
      });

      it("rejects an invalid approvalStatus at the database layer (real ENUM constraint)", async () => {
        const created = await templates.create({ publicId: uniqueId("TEMPLATE"), pageType: "y" });
        await expect(
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          templates.updateApprovalStatus(created.id, "draft", "not_a_real_status", null),
        ).rejects.toThrow();
      });
    });

    describe("updatePublishState() — atomic compare-and-swap with publishedAt stamp-once", () => {
      it("publishes (false -> true), stamping publishedAt", async () => {
        const created = await templates.create({
          publicId: uniqueId("TEMPLATE"),
          pageType: "Publish Fixture",
        });
        const result = await templates.updatePublishState(created.id, false, true, null);
        expect(result.outcome).toBe("updated");
        expect(result.outcome === "updated" && result.entity.isPublished).toBe(true);
        expect(result.outcome === "updated" && result.entity.publishedAt).not.toBeNull();
      });

      it("unpublishes (true -> false), leaving publishedAt untouched", async () => {
        const created = await templates.create({
          publicId: uniqueId("TEMPLATE"),
          pageType: "Unpublish Fixture",
        });
        const published = await templates.updatePublishState(created.id, false, true, null);
        const publishedAt = published.outcome === "updated" ? published.entity.publishedAt : null;
        expect(publishedAt).not.toBeNull();

        const result = await templates.updatePublishState(created.id, true, false, null);
        expect(result.outcome).toBe("updated");
        expect(result.outcome === "updated" && result.entity.isPublished).toBe(false);
        expect(result.outcome === "updated" && result.entity.publishedAt).toBe(publishedAt);
      });

      it("publishedAt is stamped exactly once — an unpublish/republish cycle does NOT reset it to a later time", async () => {
        const created = await templates.create({
          publicId: uniqueId("TEMPLATE"),
          pageType: "Stamp Once Fixture",
        });
        const firstPublish = await templates.updatePublishState(created.id, false, true, null);
        const firstPublishedAt =
          firstPublish.outcome === "updated" ? firstPublish.entity.publishedAt : null;
        expect(firstPublishedAt).not.toBeNull();

        await templates.updatePublishState(created.id, true, false, null); // unpublish
        // A short real delay so a bug that DID re-stamp would produce a measurably later timestamp,
        // not one indistinguishable by clock resolution alone.
        await new Promise((resolve) => setTimeout(resolve, 20));
        const republish = await templates.updatePublishState(created.id, false, true, null);

        expect(republish.outcome).toBe("updated");
        expect(republish.outcome === "updated" && republish.entity.publishedAt).toBe(
          firstPublishedAt,
        );
      });

      it("reports not_found for a missing content template", async () => {
        const result = await templates.updatePublishState(
          "00000000-0000-4000-8000-000000000000",
          false,
          true,
          null,
        );
        expect(result.outcome).toBe("not_found");
      });

      it("reports conflict (and does not write) when the expected isPublished doesn't match — a stale read", async () => {
        const created = await templates.create({
          publicId: uniqueId("TEMPLATE"),
          pageType: "Publish Conflict Fixture",
        });
        // The template is really unpublished (false); claim we expected it to already be
        // published (true) before unpublishing it — a stale read.
        const result = await templates.updatePublishState(created.id, true, false, null);
        expect(result.outcome).toBe("conflict");
        expect(result.outcome === "conflict" && result.entity.isPublished).toBe(false);

        const stillUnpublished = await templates.findById(created.id);
        expect(stillUnpublished?.isPublished).toBe(false);
      });

      it("under a genuine concurrent race (two simultaneous publish attempts), only one wins and publishedAt is stamped exactly once", async () => {
        const created = await templates.create({
          publicId: uniqueId("TEMPLATE"),
          pageType: "Real Publish Race Fixture",
        });

        const [first, second] = await Promise.all([
          templates.updatePublishState(created.id, false, true, null),
          templates.updatePublishState(created.id, false, true, null),
        ]);

        const outcomes = [first.outcome, second.outcome].sort();
        expect(outcomes).toEqual(["conflict", "updated"]);

        const final = await templates.findById(created.id);
        expect(final?.isPublished).toBe(true);
        expect(final?.publishedAt).not.toBeNull();
      });

      it("the expectedApprovalStatus CAS guard rejects a publish write once a concurrent status change has already committed — closing the TOCTOU race the guard was added for", async () => {
        // NOTE: this deliberately does NOT assert "archived and published can never both be true"
        // — D3 explicitly allows exactly that combination as a valid, non-racy outcome (a
        // published, approved template that LATER moves to archived stays published; see the e2e
        // suite's own "unpublish succeeds even after the template later moves to archived" test).
        // What the guard actually has to prevent is narrower: `publish()`'s own atomic write must
        // never succeed based on a STALE read of approvalStatus taken before the write — it must
        // re-check `approvalStatus = 'approved'` at write time, atomically with the isPublished
        // CAS. This test proves that directly and deterministically, not via an unordered race.
        const created = await templates.create({
          publicId: uniqueId("TEMPLATE"),
          pageType: "TOCTOU Guard Fixture",
        });
        const approved = await templates.updateApprovalStatus(
          created.id,
          "draft",
          "approved",
          null,
        );
        expect(approved.outcome).toBe("updated");

        // Simulates ContentTemplatesService.publish()'s own upfront findById() read: at this
        // moment, approvalStatus genuinely is "approved" — a real, valid read, not stale yet.
        const readAtPublishTime = await templates.findById(created.id);
        expect(readAtPublishTime?.approvalStatus).toBe("approved");

        // Simulates a concurrent ContentTemplatesService.changeApprovalStatus(id, "archived")
        // call landing and committing BEFORE publish()'s own write executes — the exact race
        // window the original TOCTOU finding described.
        const archived = await templates.updateApprovalStatus(
          created.id,
          "approved",
          "archived",
          null,
        );
        expect(archived.outcome).toBe("updated");

        // publish()'s own write now runs, using the (now-stale) approvalStatus it read earlier as
        // its CAS guard. Before this fix, updatePublishState() had no approvalStatus guard at all
        // and this write would have succeeded unconditionally (only isPublished was checked),
        // leaving the row archived AND published via a genuinely stale read. With the guard, the
        // write's WHERE clause re-checks `approval_status = 'approved'` against the row as it
        // actually is now — archived, not approved — so it correctly fails to match.
        const publishResult = await templates.updatePublishState(
          created.id,
          false,
          true,
          null,
          readAtPublishTime!.approvalStatus,
        );
        expect(publishResult.outcome).toBe("conflict");

        const final = await templates.findById(created.id);
        expect(final?.approvalStatus).toBe("archived");
        expect(final?.isPublished).toBe(false);
      });
    });
  });
});
