import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AssetRelatedRecordRepository, AssetRepository } from "../src/asset-library/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Asset Library schema (migration `00074`) against a REAL, disposable PostgreSQL
 * database. Mirrors ../test/module-brand-library.integration.test.ts's own structure, including
 * dedicated coverage for the two atomic compare-and-swap methods (`updateApprovalStatus()`,
 * `updatePublishState()`) under genuinely concurrent writes, the `publishedAt` stamp-once
 * contract, and — unique to this module — the `asset_related_records` polymorphic child table's
 * real `(id, assetId)` IDOR scoping.
 */
describe("Asset Library module (real disposable database)", () => {
  const assets = new AssetRepository();
  const relatedRecords = new AssetRelatedRecordRepository();

  let counter = 0;
  function uniqueId(prefix: string): string {
    counter += 1;
    return `${prefix}-${Date.now()}-${counter}`;
  }

  async function newAsset(overrides: Record<string, unknown> = {}) {
    return assets.create({
      publicId: uniqueId("ASSET"),
      title: "Homepage hero image",
      ...overrides,
    });
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

  describe("AssetRepository", () => {
    it("creates an asset defaulting to draft, version 1, unpublished, scan not_configured", async () => {
      const created = await newAsset();
      expect(created.approvalStatus).toBe("draft");
      expect(created.version).toBe(1);
      expect(created.isPublished).toBe(false);
      expect(created.publishedAt).toBeNull();
      // D4 — the registry's own seeded text forbids ever claiming a file is malware-free.
      expect(created.scanStatus).toBe("not_configured");
      // D2 — never `public` by default.
      expect(created.visibility).toBe("internal");
      expect(created.fileReference).toBeNull();
    });

    it("round-trips every scalar content field", async () => {
      const created = await newAsset({
        description: "The hero image used on the homepage",
        fileReference: "https://cdn.example.com/hero.png",
        mimeType: "image/png",
        fileSizeBytes: "204800",
        checksum: "sha256:abc123",
        widthPx: 1920,
        heightPx: 1080,
        durationSeconds: null,
        licence: "CC BY 4.0",
        licenceHolder: "WebDesk Solution",
        consentReference: "Signed model release on file",
        altTextGuidance: "Describe the product, not the styling",
        visibility: "restricted",
        retentionNote: "Delete 2 years after campaign end",
      });

      const found = await assets.findById(created.id);
      expect(found?.description).toBe("The hero image used on the homepage");
      expect(found?.fileReference).toBe("https://cdn.example.com/hero.png");
      expect(found?.mimeType).toBe("image/png");
      // BIGINT comes back from Postgres as a string, which is what the entity type declares.
      expect(found?.fileSizeBytes).toBe("204800");
      expect(found?.checksum).toBe("sha256:abc123");
      expect(found?.widthPx).toBe(1920);
      expect(found?.heightPx).toBe(1080);
      expect(found?.licence).toBe("CC BY 4.0");
      expect(found?.licenceHolder).toBe("WebDesk Solution");
      expect(found?.consentReference).toBe("Signed model release on file");
      expect(found?.altTextGuidance).toBe("Describe the product, not the styling");
      expect(found?.visibility).toBe("restricted");
      expect(found?.retentionNote).toBe("Delete 2 years after campaign end");
    });

    it("stores a fileSizeBytes value beyond INTEGER range (the column is a real BIGINT)", async () => {
      // 5 GiB — comfortably past INTEGER's ~2.1GB ceiling, which is exactly why the column is a
      // BIGINT rather than an INTEGER.
      const created = await newAsset({ fileSizeBytes: "5368709120" });
      const found = await assets.findById(created.id);
      expect(found?.fileSizeBytes).toBe("5368709120");
    });

    it("rejects an invalid visibility at the database layer (real ENUM constraint)", async () => {
      await expect(
        newAsset({
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          visibility: "top_secret",
        }),
      ).rejects.toThrow();
    });

    it("ignores a caller-supplied scanStatus entirely, always writing not_configured (D4)", async () => {
      // The repository hardcodes `not_configured` rather than reading `input.scanStatus`, so even
      // a caller that gets past the DTO layer can never assert a scan result — least of all
      // `clean`, which the module registry's own seeded text forbids this system from claiming.
      const created = await assets.create({
        publicId: uniqueId("ASSET"),
        title: "X",
        // @ts-expect-error deliberately supplied to prove the repository ignores it
        scanStatus: "clean",
      });
      expect(created.scanStatus).toBe("not_configured");
    });

    it("rejects a duplicate publicId at the database layer", async () => {
      const publicId = uniqueId("ASSET");
      await assets.create({ publicId, title: "First" });
      await expect(assets.create({ publicId, title: "Second" })).rejects.toThrow();
    });

    it("increments version on every content update", async () => {
      const created = await newAsset();
      const first = await assets.update(created.id, { title: "v2" });
      expect(first?.version).toBe(2);
      const second = await assets.update(created.id, { title: "v3" });
      expect(second?.version).toBe(3);
    });

    it("honours the expectedApprovalStatus CAS guard on update()", async () => {
      const created = await newAsset();
      // Guard matches the real current status — the write lands.
      const ok = await assets.update(created.id, { title: "v2" }, "draft");
      expect(ok?.title).toBe("v2");
      // Guard does NOT match — the write is refused, which is what stops an edit from landing on
      // a row another request has since archived.
      const refused = await assets.update(created.id, { title: "v3" }, "approved");
      expect(refused).toBeNull();
      const unchanged = await assets.findById(created.id);
      expect(unchanged?.title).toBe("v2");
    });

    it("lets only ONE of two genuinely concurrent status transitions win", async () => {
      const created = await newAsset();
      // `updatedBy` is null, not a label: the column is a real UUID with a foreign key into
      // `users`, so an arbitrary string is rejected by the database. The CAS guard is on
      // `(id, approvalStatus)` anyway — actor identity plays no part in which caller wins.
      const [a, b] = await Promise.all([
        assets.updateApprovalStatus(created.id, "draft", "submitted", null),
        assets.updateApprovalStatus(created.id, "draft", "submitted", null),
      ]);
      const outcomes = [a.outcome, b.outcome].sort();
      expect(outcomes).toEqual(["conflict", "updated"]);
    });

    it("reports not_found for a status transition on a missing row", async () => {
      const result = await assets.updateApprovalStatus(
        "99999999-9999-4999-8999-999999999999",
        "draft",
        "submitted",
        null,
      );
      expect(result.outcome).toBe("not_found");
    });

    it("does not change version on a status transition", async () => {
      const created = await newAsset();
      const result = await assets.updateApprovalStatus(created.id, "draft", "submitted", null);
      expect(result.outcome).toBe("updated");
      if (result.outcome === "updated") {
        expect(result.entity.version).toBe(1);
      }
    });

    it("stamps publishedAt once and never overwrites it across a republish cycle", async () => {
      const created = await newAsset();
      await assets.updateApprovalStatus(created.id, "draft", "submitted", null);
      await assets.updateApprovalStatus(created.id, "submitted", "under_review", null);
      await assets.updateApprovalStatus(created.id, "under_review", "approved", null);

      const published = await assets.updatePublishState(created.id, false, true, null, "approved");
      expect(published.outcome).toBe("updated");
      const firstStamp = published.outcome === "updated" ? published.entity.publishedAt : null;
      expect(firstStamp).not.toBeNull();

      // Unpublish must NOT clear the stamp — it is permanent history of the first publish.
      const unpublished = await assets.updatePublishState(created.id, true, false, null);
      expect(unpublished.outcome).toBe("updated");
      if (unpublished.outcome === "updated") {
        expect(unpublished.entity.publishedAt).toBe(firstStamp);
      }

      // Republish must NOT re-stamp it to the later time.
      const republished = await assets.updatePublishState(created.id, false, true, null);
      expect(republished.outcome).toBe("updated");
      if (republished.outcome === "updated") {
        expect(republished.entity.publishedAt).toBe(firstStamp);
      }
    });

    it("refuses to publish when the approvalStatus CAS guard does not match", async () => {
      const created = await newAsset(); // still draft
      const result = await assets.updatePublishState(created.id, false, true, null, "approved");
      // The guard is what stops a concurrent approved->archived transition from being raced past.
      expect(result.outcome).toBe("conflict");
      const stillUnpublished = await assets.findById(created.id);
      expect(stillUnpublished?.isPublished).toBe(false);
    });

    it("lets only ONE of two genuinely concurrent publishes win", async () => {
      const created = await newAsset();
      await assets.updateApprovalStatus(created.id, "draft", "submitted", null);
      await assets.updateApprovalStatus(created.id, "submitted", "under_review", null);
      await assets.updateApprovalStatus(created.id, "under_review", "approved", null);

      // `updatedBy` is null for the same reason as the status-transition race above.
      const [a, b] = await Promise.all([
        assets.updatePublishState(created.id, false, true, null, "approved"),
        assets.updatePublishState(created.id, false, true, null, "approved"),
      ]);
      const outcomes = [a.outcome, b.outcome].sort();
      expect(outcomes).toEqual(["conflict", "updated"]);
    });

    it("filters by visibility, scanStatus, mimeType, approvalStatus and search", async () => {
      const marker = uniqueId("FILTERABLE");
      await newAsset({
        title: `${marker} restricted png`,
        visibility: "restricted",
        mimeType: "image/png",
      });
      await newAsset({
        title: `${marker} public pdf`,
        visibility: "public",
        mimeType: "application/pdf",
      });

      const restricted = await assets.list({ visibility: "restricted", search: marker });
      expect(restricted).toHaveLength(1);
      expect(restricted[0]?.visibility).toBe("restricted");

      const pdfs = await assets.list({ mimeType: "application/pdf", search: marker });
      expect(pdfs).toHaveLength(1);

      // Every asset starts not_configured, so both rows match this filter.
      const unscanned = await assets.list({ scanStatus: "not_configured", search: marker });
      expect(unscanned).toHaveLength(2);

      const drafts = await assets.list({ approvalStatus: "draft", search: marker });
      expect(drafts).toHaveLength(2);
    });

    it("treats a literal % in search as text, not a wildcard", async () => {
      const marker = uniqueId("ESCAPE");
      await newAsset({ title: `${marker} 100% cotton` });
      await newAsset({ title: `${marker} plain` });

      // Without escapeLikePattern() this would match both rows.
      const matched = await assets.list({ search: "100% cotton" });
      expect(matched.every((row) => row.title.includes("100% cotton"))).toBe(true);
      expect(matched.some((row) => row.title.endsWith("plain"))).toBe(false);
    });

    it("clamps an over-large list limit rather than honouring it", async () => {
      const rows = await assets.list({ limit: 5000 });
      expect(rows.length).toBeLessThanOrEqual(200);
    });
  });

  describe("AssetRelatedRecordRepository (polymorphic child table, D3)", () => {
    it("links an asset to a record in another module and lists it back", async () => {
      const asset = await newAsset();
      const created = await relatedRecords.create({
        assetId: asset.id,
        moduleKey: "page_inventory",
        recordId: "33333333-3333-4333-8333-333333333333",
        note: "Used in the hero band",
      });

      expect(created.moduleKey).toBe("page_inventory");
      const listed = await relatedRecords.listByAsset(asset.id);
      expect(listed).toHaveLength(1);
      expect(listed[0]?.id).toBe(created.id);
    });

    it("rejects linking the same target to the same asset twice (real unique index)", async () => {
      const asset = await newAsset();
      const target = {
        assetId: asset.id,
        moduleKey: "page_inventory",
        recordId: "44444444-4444-4444-8444-444444444444",
      };
      await relatedRecords.create(target);
      await expect(relatedRecords.create(target)).rejects.toThrow();
    });

    it("allows the same target to be linked to two DIFFERENT assets", async () => {
      const [assetA, assetB] = await Promise.all([newAsset(), newAsset()]);
      const recordId = "55555555-5555-4555-8555-555555555555";
      await relatedRecords.create({ assetId: assetA.id, moduleKey: "page_inventory", recordId });
      await relatedRecords.create({ assetId: assetB.id, moduleKey: "page_inventory", recordId });

      const byTarget = await relatedRecords.listByTarget("page_inventory", recordId);
      expect(byTarget).toHaveLength(2);
    });

    it("scopes findById by (id, assetId) — real IDOR prevention", async () => {
      const [assetA, assetB] = await Promise.all([newAsset(), newAsset()]);
      const link = await relatedRecords.create({
        assetId: assetA.id,
        moduleKey: "page_inventory",
        recordId: "66666666-6666-4666-8666-666666666666",
      });

      expect(await relatedRecords.findById(link.id, assetA.id)).not.toBeNull();
      // Asset B must not be able to reach asset A's link row by id.
      expect(await relatedRecords.findById(link.id, assetB.id)).toBeNull();
    });

    it("scopes update by (id, assetId) — a foreign asset's write affects 0 rows", async () => {
      const [assetA, assetB] = await Promise.all([newAsset(), newAsset()]);
      const link = await relatedRecords.create({
        assetId: assetA.id,
        moduleKey: "page_inventory",
        recordId: "77777777-7777-4777-8777-777777777777",
        note: "original",
      });

      expect(await relatedRecords.update(link.id, assetB.id, { note: "hijacked" })).toBeNull();
      const untouched = await relatedRecords.findById(link.id, assetA.id);
      expect(untouched?.note).toBe("original");

      const ok = await relatedRecords.update(link.id, assetA.id, { note: "updated" });
      expect(ok?.note).toBe("updated");
    });

    it("scopes remove by (id, assetId) — a foreign asset's delete removes nothing", async () => {
      const [assetA, assetB] = await Promise.all([newAsset(), newAsset()]);
      const link = await relatedRecords.create({
        assetId: assetA.id,
        moduleKey: "page_inventory",
        recordId: "88888888-8888-4888-8888-888888888888",
      });

      expect(await relatedRecords.remove(link.id, assetB.id)).toBe(false);
      expect(await relatedRecords.findById(link.id, assetA.id)).not.toBeNull();

      expect(await relatedRecords.remove(link.id, assetA.id)).toBe(true);
      expect(await relatedRecords.findById(link.id, assetA.id)).toBeNull();
    });

    it("rejects a link to a nonexistent asset (real foreign key)", async () => {
      await expect(
        relatedRecords.create({
          assetId: "99999999-9999-4999-8999-999999999999",
          moduleKey: "page_inventory",
          recordId: "12121212-1212-4212-8212-121212121212",
        }),
      ).rejects.toThrow();
    });
  });
});
