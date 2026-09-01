import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PortfolioAssetRepository,
  PortfolioRecordRepository,
} from "../src/portfolio-library/index.js";
import { closeConnection, getConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Portfolio Library schema (migration `00095`) against a REAL, disposable
 * PostgreSQL database. Mirrors ../test/module-content-template-library.integration.test.ts's own
 * structure, plus dedicated coverage for the two atomic compare-and-swap methods
 * (`updateApprovalStatus()`, `updatePublishState()`) under genuinely concurrent writes, the
 * `publishedAt` stamp-once contract, the three NOT-NULL array field columns
 * (`additionalCategories`/`tags`/`relatedProofIds`), and `portfolio_assets` — a real many-to-many
 * join into `assets`, mirroring `case_study_assets`'s own already-reviewed integration coverage.
 */
describe("Portfolio Library module (real disposable database)", () => {
  const records = new PortfolioRecordRepository();
  const assets = new PortfolioAssetRepository();

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

  describe("PortfolioRecordRepository", () => {
    it("creates a portfolio record defaulting to draft approvalStatus, version 1, unpublished, empty arrays", async () => {
      const created = await records.create({
        publicId: uniqueId("PORTFOLIO"),
        projectOrClientName: "Acme Co.",
      });
      expect(created.approvalStatus).toBe("draft");
      expect(created.version).toBe(1);
      expect(created.isPublished).toBe(false);
      expect(created.publishedAt).toBeNull();
      expect(created.additionalCategories).toEqual([]);
      expect(created.tags).toEqual([]);
      expect(created.relatedProofIds).toEqual([]);
      expect(created.visibility).toBe("internal_only");
    });

    it("round-trips additionalCategories/tags/relatedProofIds array columns", async () => {
      const proofId = randomUUID();
      const created = await records.create({
        publicId: uniqueId("PORTFOLIO"),
        projectOrClientName: "Blog Post Client",
        additionalCategories: ["E-Commerce", "SaaS"],
        tags: ["Featured"],
        relatedProofIds: [proofId],
      });
      const found = await records.findById(created.id);
      expect(found?.additionalCategories).toEqual(["E-Commerce", "SaaS"]);
      expect(found?.tags).toEqual(["Featured"]);
      expect(found?.relatedProofIds).toEqual([proofId]);
    });

    it("stores an explicit null array field as an empty array, not null (NOT NULL columns, unlike Content Template Library's nullable ones)", async () => {
      const created = await records.create({
        publicId: uniqueId("PORTFOLIO"),
        projectOrClientName: "Landing Page Client",
        tags: null,
      });
      expect(created.tags).toEqual([]);
    });

    it("round-trips launchDate as a plain YYYY-MM-DD string (DATEONLY)", async () => {
      const created = await records.create({
        publicId: uniqueId("PORTFOLIO"),
        projectOrClientName: "Launch Date Client",
        launchDate: "2026-01-15",
      });
      expect(created.launchDate).toBe("2026-01-15");
    });

    it("rejects a duplicate publicId at the database layer", async () => {
      const publicId = uniqueId("PORTFOLIO");
      await records.create({ publicId, projectOrClientName: "First" });
      await expect(records.create({ publicId, projectOrClientName: "Second" })).rejects.toThrow();
    });

    it("finds by publicId, and returns null for a missing one", async () => {
      const publicId = uniqueId("PORTFOLIO");
      const created = await records.create({ publicId, projectOrClientName: "X" });
      expect((await records.findByPublicId(publicId))?.id).toBe(created.id);
      expect(await records.findByPublicId("PORTFOLIO-does-not-exist")).toBeNull();
    });

    it("findById returns null for a missing portfolio record", async () => {
      expect(await records.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("list() filters by approvalStatus, isPublished, and search (case-insensitive)", async () => {
      const uniqueName = uniqueId("Unique Searchable Client Name");
      await records.create({ publicId: uniqueId("PORTFOLIO"), projectOrClientName: uniqueName });

      const byStatus = await records.list({ approvalStatus: "draft" });
      expect(byStatus.length).toBeGreaterThanOrEqual(1);

      const byPublished = await records.list({ isPublished: false });
      expect(byPublished.length).toBeGreaterThanOrEqual(1);

      const bySearch = await records.list({ search: uniqueName.toLowerCase() });
      expect(bySearch.length).toBe(1);
    });

    it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
      const uniqueSuffix = uniqueId("PCT");
      const wildcardMatch = await records.create({
        publicId: uniqueId("PORTFOLIO"),
        projectOrClientName: `50% Off Client ${uniqueSuffix}`,
      });
      const plainMatch = await records.create({
        publicId: uniqueId("PORTFOLIO"),
        projectOrClientName: `50X Off Client ${uniqueSuffix}`,
      });

      const result = await records.list({ search: `50% Off Client ${uniqueSuffix}` });
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
        publicId: uniqueId("PORTFOLIO"),
        projectOrClientName: "Original",
      });
      expect(created.version).toBe(1);

      const updated = await records.update(created.id, { projectOrClientName: "Renamed" });
      expect(updated?.projectOrClientName).toBe("Renamed");
      expect(updated?.approvalStatus).toBe("draft");
      expect(updated?.isPublished).toBe(false);
      expect(updated?.publishedAt).toBeNull();
      expect(updated?.version).toBe(2);

      const updatedAgain = await records.update(created.id, {
        projectOrClientName: "Renamed Again",
      });
      expect(updatedAgain?.version).toBe(3);
    });

    it("update()'s optional expectedApprovalStatus guard rejects (returns null) a stale-status write and leaves the row untouched", async () => {
      const created = await records.create({
        publicId: uniqueId("PORTFOLIO"),
        projectOrClientName: "CAS Guard Fixture",
      });

      // Claim we expected the row to still be "submitted" when it's really "draft" — a stale read.
      const result = await records.update(
        created.id,
        { projectOrClientName: "Should Not Apply" },
        "submitted",
      );
      expect(result).toBeNull();

      const stillOriginal = await records.findById(created.id);
      expect(stillOriginal?.projectOrClientName).toBe("CAS Guard Fixture");
      expect(stillOriginal?.version).toBe(1);
    });

    it("update() with the correct expectedApprovalStatus succeeds normally", async () => {
      const created = await records.create({
        publicId: uniqueId("PORTFOLIO"),
        projectOrClientName: "CAS Guard Match Fixture",
      });

      const result = await records.update(created.id, { projectOrClientName: "Renamed" }, "draft");
      expect(result?.projectOrClientName).toBe("Renamed");
      expect(result?.version).toBe(2);
    });

    it("update() with concurrent-style repeated calls still increments version atomically (no lost updates)", async () => {
      const created = await records.create({
        publicId: uniqueId("PORTFOLIO"),
        projectOrClientName: "Concurrency Fixture",
      });

      // Fire several updates "concurrently" (no await between issuing them) — a naive
      // read-then-write `version: current + 1` would lose increments under this exact shape; the
      // real atomic `UPDATE ... SET version = version + 1` must not.
      await Promise.all([
        records.update(created.id, { industry: "A" }),
        records.update(created.id, { industry: "B" }),
        records.update(created.id, { industry: "C" }),
      ]);

      const final = await records.findById(created.id);
      expect(final?.version).toBe(4); // 1 (create) + 3 concurrent updates
    });

    it("update() returns null for a missing portfolio record", async () => {
      expect(
        await records.update("00000000-0000-4000-8000-000000000000", { projectOrClientName: "x" }),
      ).toBeNull();
    });

    it("update() stores an explicit null on a NOT NULL array field as an empty array, distinct from leaving it untouched", async () => {
      const created = await records.create({
        publicId: uniqueId("PORTFOLIO"),
        projectOrClientName: "Array Clearing Fixture",
        additionalCategories: ["Category A"],
        tags: ["Tag A"],
      });

      const updated = await records.update(created.id, { additionalCategories: null });
      expect(updated?.additionalCategories).toEqual([]);
      expect(updated?.tags).toEqual(["Tag A"]);
    });

    describe("updateApprovalStatus() — atomic compare-and-swap", () => {
      it("changes approvalStatus when the expected current status matches, and does not touch version", async () => {
        const created = await records.create({
          publicId: uniqueId("PORTFOLIO"),
          projectOrClientName: "Status Fixture",
        });
        const result = await records.updateApprovalStatus(created.id, "draft", "submitted", null);
        expect(result.outcome).toBe("updated");
        expect(result.outcome === "updated" && result.entity.approvalStatus).toBe("submitted");
        expect(result.outcome === "updated" && result.entity.version).toBe(1);
      });

      it("reports not_found for a missing portfolio record", async () => {
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
          publicId: uniqueId("PORTFOLIO"),
          projectOrClientName: "Conflict Fixture",
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
          publicId: uniqueId("PORTFOLIO"),
          projectOrClientName: "Real Race Fixture",
        });

        const [first, second] = await Promise.all([
          records.updateApprovalStatus(created.id, "draft", "submitted", null),
          records.updateApprovalStatus(created.id, "draft", "archived", null),
        ]);

        const outcomes = [first.outcome, second.outcome].sort();
        expect(outcomes).toEqual(["conflict", "updated"]);

        const final = await records.findById(created.id);
        // Whichever won, the final state must be exactly one of the two attempted values, never
        // both applied and never left at the original "draft".
        expect(["submitted", "archived"]).toContain(final?.approvalStatus);
      });

      it("rejects an invalid approvalStatus at the database layer (real ENUM constraint)", async () => {
        const created = await records.create({
          publicId: uniqueId("PORTFOLIO"),
          projectOrClientName: "y",
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
          publicId: uniqueId("PORTFOLIO"),
          projectOrClientName: "Publish Fixture",
        });
        const result = await records.updatePublishState(created.id, false, true, null);
        expect(result.outcome).toBe("updated");
        expect(result.outcome === "updated" && result.entity.isPublished).toBe(true);
        expect(result.outcome === "updated" && result.entity.publishedAt).not.toBeNull();
      });

      it("unpublishes (true -> false), leaving publishedAt untouched", async () => {
        const created = await records.create({
          publicId: uniqueId("PORTFOLIO"),
          projectOrClientName: "Unpublish Fixture",
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
          publicId: uniqueId("PORTFOLIO"),
          projectOrClientName: "Stamp Once Fixture",
        });
        const firstPublish = await records.updatePublishState(created.id, false, true, null);
        const firstPublishedAt =
          firstPublish.outcome === "updated" ? firstPublish.entity.publishedAt : null;
        expect(firstPublishedAt).not.toBeNull();

        await records.updatePublishState(created.id, true, false, null); // unpublish
        // A short real delay so a bug that DID re-stamp would produce a measurably later timestamp,
        // not one indistinguishable by clock resolution alone.
        await new Promise((resolve) => setTimeout(resolve, 20));
        const republish = await records.updatePublishState(created.id, false, true, null);

        expect(republish.outcome).toBe("updated");
        expect(republish.outcome === "updated" && republish.entity.publishedAt).toBe(
          firstPublishedAt,
        );
      });

      it("reports not_found for a missing portfolio record", async () => {
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
          publicId: uniqueId("PORTFOLIO"),
          projectOrClientName: "Publish Conflict Fixture",
        });
        // The record is really unpublished (false); claim we expected it to already be published
        // (true) before unpublishing it — a stale read.
        const result = await records.updatePublishState(created.id, true, false, null);
        expect(result.outcome).toBe("conflict");
        expect(result.outcome === "conflict" && result.entity.isPublished).toBe(false);

        const stillUnpublished = await records.findById(created.id);
        expect(stillUnpublished?.isPublished).toBe(false);
      });

      it("under a genuine concurrent race (two simultaneous publish attempts), only one wins and publishedAt is stamped exactly once", async () => {
        const created = await records.create({
          publicId: uniqueId("PORTFOLIO"),
          projectOrClientName: "Real Publish Race Fixture",
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
          publicId: uniqueId("PORTFOLIO"),
          projectOrClientName: "TOCTOU Guard Fixture",
        });
        const approved = await records.updateApprovalStatus(created.id, "draft", "approved", null);
        expect(approved.outcome).toBe("updated");

        // Simulates PortfolioRecordsService.publish()'s own upfront findById() read: at this
        // moment, approvalStatus genuinely is "approved" — a real, valid read, not stale yet.
        const readAtPublishTime = await records.findById(created.id);
        expect(readAtPublishTime?.approvalStatus).toBe("approved");

        // Simulates a concurrent PortfolioRecordsService.changeApprovalStatus(id, "archived") call
        // landing and committing BEFORE publish()'s own write executes.
        const archived = await records.updateApprovalStatus(
          created.id,
          "approved",
          "archived",
          null,
        );
        expect(archived.outcome).toBe("updated");

        // publish()'s own write now runs, using the (now-stale) approvalStatus it read earlier as
        // its CAS guard. Without the guard this write would have succeeded unconditionally.
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

  describe("PortfolioAssetRepository (screenshots, D2 — real join into `assets`, no DB-level FK)", () => {
    // `assetId` has no DB-level FK into `assets` (D2, app-layer validated elsewhere via
    // AssetsService.existingAssetIds()) — mirrors module-case-study-studio.integration.test.ts's
    // own identical shape, which likewise uses a fabricated UUID literal rather than inserting a
    // real `assets` row, since Asset Library's own schema is not under test here.
    it("creates a portfolio-asset link and round-trips it via listByPortfolioRecord()", async () => {
      const record = await records.create({
        publicId: uniqueId("PORTFOLIO"),
        projectOrClientName: "Screenshot Fixture",
      });
      const assetId = "00000000-0000-4000-8000-000000000001";

      const created = await assets.create({
        portfolioRecordId: record.id,
        assetId,
        role: "hero_screenshot",
        caption: "Homepage hero",
      });
      expect(created.assetId).toBe(assetId);
      expect(created.caption).toBe("Homepage hero");

      const list = await assets.listByPortfolioRecord(record.id);
      expect(list.map((a) => a.id)).toContain(created.id);
    });

    it("rejects a duplicate (portfolioRecordId, assetId) link at the database layer", async () => {
      const record = await records.create({
        publicId: uniqueId("PORTFOLIO"),
        projectOrClientName: "Duplicate Link Fixture",
      });
      const assetId = "00000000-0000-4000-8000-000000000002";
      await assets.create({ portfolioRecordId: record.id, assetId, role: "logo" });

      await expect(
        assets.create({ portfolioRecordId: record.id, assetId, role: "logo" }),
      ).rejects.toThrow();
    });

    it("cascades: deleting the parent portfolio record deletes its linked screenshots", async () => {
      const record = await records.create({
        publicId: uniqueId("PORTFOLIO"),
        projectOrClientName: "Cascade Fixture",
      });
      const assetId = "00000000-0000-4000-8000-000000000003";
      const created = await assets.create({ portfolioRecordId: record.id, assetId, role: "logo" });

      const sequelize = getConnection();
      await sequelize.query("DELETE FROM portfolio_records WHERE id = :id", {
        replacements: { id: record.id },
      });

      expect(await assets.findById(created.id)).toBeNull();
    });

    it("update()/remove() are scoped to portfolioRecordId (IDOR prevention) — a mismatched id is treated as not found", async () => {
      const record = await records.create({
        publicId: uniqueId("PORTFOLIO"),
        projectOrClientName: "IDOR Fixture",
      });
      const otherRecord = await records.create({
        publicId: uniqueId("PORTFOLIO"),
        projectOrClientName: "Other IDOR Fixture",
      });
      const assetId = "00000000-0000-4000-8000-000000000004";
      const created = await assets.create({ portfolioRecordId: record.id, assetId, role: "logo" });

      expect(await assets.update(created.id, otherRecord.id, { role: "video" })).toBeNull();
      expect(await assets.remove(created.id, otherRecord.id)).toBe(false);

      const stillThere = await assets.findById(created.id);
      expect(stillThere?.role).toBe("logo");
    });

    it("update() and remove() succeed when correctly scoped", async () => {
      const record = await records.create({
        publicId: uniqueId("PORTFOLIO"),
        projectOrClientName: "Scoped Fixture",
      });
      const assetId = "00000000-0000-4000-8000-000000000005";
      const created = await assets.create({ portfolioRecordId: record.id, assetId, role: "logo" });

      const updated = await assets.update(created.id, record.id, { role: "video" });
      expect(updated?.role).toBe("video");

      expect(await assets.remove(created.id, record.id)).toBe(true);
      expect(await assets.findById(created.id)).toBeNull();
    });
  });
});
