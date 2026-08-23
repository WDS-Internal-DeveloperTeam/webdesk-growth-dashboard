import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebsiteStrategyRecordRepository } from "../src/website-strategy-center/index.js";
import { closeConnection, getConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";
import { withTransaction } from "../src/transaction.js";

/**
 * Exercises the Website Strategy Center schema (migration `00056`) against a REAL, disposable
 * PostgreSQL database. Mirrors ../test/module-proof-and-claims-library.integration.test.ts's own
 * structure, plus real coverage for this module's own genuinely new mechanism among the 6
 * business modules built so far: real multi-row version history (task package D2/D3) — the
 * partial-unique-index-on-`is_current` behavior, the `(record_id, version_number)` uniqueness,
 * and a full end-to-end version-history round trip (create -> approve -> edit-the-approved-one
 * -> verify 2 rows exist -> approve the new one -> verify the old row is superseded).
 */
describe("Website Strategy Center module (real disposable database)", () => {
  const records = new WebsiteStrategyRecordRepository();

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

  describe("WebsiteStrategyRecordRepository — basic CRUD", () => {
    it("creates a record defaulting to draft approvalStatus, versionNumber 1, isCurrent true", async () => {
      const created = await records.create({
        publicId: uniqueId("WSC-NAV"),
        recordType: "navigation_plan",
        title: "Q1 Navigation Plan",
      });
      expect(created.approvalStatus).toBe("draft");
      expect(created.versionNumber).toBe(1);
      expect(created.isCurrent).toBe(true);
      expect(created.recordId).toBeTruthy();
      // Each newly created record gets its own fresh recordId — never the same as its own row id
      // by coincidence being asserted here, just confirming it is a real, distinct UUID.
      expect(created.recordId).not.toBe(created.id);
    });

    it("findCurrentByRecordId / findCurrentByPublicId return null for an unknown id", async () => {
      expect(await records.findCurrentByRecordId(randomUUID())).toBeNull();
      expect(await records.findCurrentByPublicId("WSC-does-not-exist")).toBeNull();
    });

    it("findCurrentByRecordId / findCurrentByPublicId find a real created record", async () => {
      const publicId = uniqueId("WSC-NAV");
      const created = await records.create({
        publicId,
        recordType: "page_clusters",
        title: "Cluster Plan",
      });
      expect((await records.findCurrentByRecordId(created.recordId))?.id).toBe(created.id);
      expect((await records.findCurrentByPublicId(publicId))?.id).toBe(created.id);
    });

    it("list() filters by recordType/approvalStatus/search (case-insensitive) and only returns isCurrent rows", async () => {
      const uniqueTitle = uniqueId("Unique Searchable Title");
      await records.create({
        publicId: uniqueId("WSC-NAV"),
        recordType: "navigation_plan",
        title: uniqueTitle,
      });

      const byType = await records.list({ recordType: "navigation_plan" });
      expect(byType.length).toBeGreaterThanOrEqual(1);
      expect(byType.every((r) => r.recordType === "navigation_plan")).toBe(true);

      const byStatus = await records.list({ approvalStatus: "draft" });
      expect(byStatus.length).toBeGreaterThanOrEqual(1);

      const bySearch = await records.list({ search: uniqueTitle.toLowerCase() });
      expect(bySearch.length).toBe(1);
    });

    it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
      const uniqueSuffix = uniqueId("PCT");
      const wildcardMatch = await records.create({
        publicId: uniqueId("WSC-PCT"),
        recordType: "conversion_plan",
        title: `50% Off Conversion Plan ${uniqueSuffix}`,
      });
      const plainMatch = await records.create({
        publicId: uniqueId("WSC-PCT"),
        recordType: "conversion_plan",
        title: `50X Off Conversion Plan ${uniqueSuffix}`,
      });

      const found = await records.list({ search: `50% Off Conversion Plan ${uniqueSuffix}` });
      const ids = found.map((r) => r.id);
      expect(ids).toContain(wildcardMatch.id);
      expect(ids).not.toContain(plainMatch.id);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await records.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("updateInPlace() changes content fields and never touches approvalStatus/recordType", async () => {
      const created = await records.create({
        publicId: uniqueId("WSC-NAV"),
        recordType: "search_plan",
        title: "Original",
      });

      const updated = await records.updateInPlace(created.id, { title: "Renamed" });
      expect(updated?.title).toBe("Renamed");
      expect(updated?.approvalStatus).toBe("draft");
      expect(updated?.recordType).toBe("search_plan");
    });

    it("updateInPlace() returns null for a missing row id", async () => {
      expect(await records.updateInPlace(randomUUID(), { title: "x" })).toBeNull();
    });

    it("updateApprovalStatus() changes approvalStatus when the expected current status matches", async () => {
      const created = await records.create({
        publicId: uniqueId("WSC-NAV"),
        recordType: "industry_strategy",
        title: "Status Fixture",
      });
      const result = await records.updateApprovalStatus(created.id, "draft", "submitted", null);
      expect(result.outcome).toBe("updated");
      expect(result.outcome === "updated" && result.entity.approvalStatus).toBe("submitted");
    });

    it("updateApprovalStatus() reports not_found for a missing row id", async () => {
      const result = await records.updateApprovalStatus(randomUUID(), "draft", "submitted", null);
      expect(result.outcome).toBe("not_found");
    });

    it("updateApprovalStatus() reports conflict (and does not write) on the atomic compare-and-swap", async () => {
      const created = await records.create({
        publicId: uniqueId("WSC-NAV"),
        recordType: "location_strategy",
        title: "Conflict Fixture",
      });
      // The row is really `draft`; we claim we expected `submitted` — a stale read.
      const result = await records.updateApprovalStatus(
        created.id,
        "submitted",
        "under_review",
        null,
      );
      expect(result.outcome).toBe("conflict");
      expect(result.outcome === "conflict" && result.entity.approvalStatus).toBe("draft");

      const stillDraft = await records.findCurrentByRecordId(created.recordId);
      expect(stillDraft?.approvalStatus).toBe("draft");
    });

    it("rejects an invalid approvalStatus at the database layer (real ENUM constraint)", async () => {
      const created = await records.create({
        publicId: uniqueId("WSC-NAV"),
        recordType: "platform_strategy",
        title: "Enum Fixture",
      });
      await expect(
        // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
        records.updateApprovalStatus(created.id, "draft", "not_a_real_status", null),
      ).rejects.toThrow();
    });

    it("rejects an invalid recordType at the database layer (real ENUM constraint)", async () => {
      await expect(
        records.create({
          publicId: uniqueId("WSC-NAV"),
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          recordType: "not_a_real_record_type",
          title: "Enum Fixture 2",
        }),
      ).rejects.toThrow();
    });
  });

  describe("partial-unique-index behavior (WHERE is_current = true)", () => {
    it("rejects a second DIFFERENT record reusing the same publicId while both are current", async () => {
      const publicId = uniqueId("WSC-DUP");
      await records.create({ publicId, recordType: "navigation_plan", title: "First record" });
      await expect(
        records.create({ publicId, recordType: "navigation_plan", title: "Second record" }),
      ).rejects.toThrow();
    });

    it("allows creating a new VERSION of the same record that legitimately repeats the same publicId, once the old row's isCurrent is flipped false first", async () => {
      const publicId = uniqueId("WSC-VER");
      const v1 = await records.create({ publicId, recordType: "navigation_plan", title: "V1" });

      await withTransaction(async (transaction) => {
        await records.updateInPlace(v1.id, { isCurrent: false }, transaction);
        await records.createNewVersion(
          {
            recordId: v1.recordId,
            publicId,
            recordType: "navigation_plan",
            versionNumber: 2,
            title: "V2",
            content: null,
            notes: null,
          },
          transaction,
        );
      });

      const current = await records.findCurrentByPublicId(publicId);
      expect(current?.title).toBe("V2");
      expect(current?.versionNumber).toBe(2);

      const allVersions = await records.listVersions(v1.recordId);
      expect(allVersions.length).toBe(2);
    });

    it("rejects two versions of the SAME record sharing the same versionNumber ((record_id, version_number) unique index)", async () => {
      const created = await records.create({
        publicId: uniqueId("WSC-DUPVER"),
        recordType: "navigation_plan",
        title: "V1",
      });
      // versionNumber 1 already exists for this recordId (the row just created above) — a second
      // row claiming versionNumber 1 for the same recordId must be rejected.
      await expect(
        records.createNewVersion({
          recordId: created.recordId,
          publicId: uniqueId("WSC-DUPVER-2"),
          recordType: "navigation_plan",
          versionNumber: 1,
          title: "Duplicate version number",
          content: null,
          notes: null,
        }),
      ).rejects.toThrow();
    });
  });

  describe("full real end-to-end version-history round trip", () => {
    it("create -> approve -> edit-the-approved-one -> verify 2 rows -> approve the new one -> verify the old row is superseded", async () => {
      const publicId = uniqueId("WSC-E2E");
      const v1 = await records.create({
        publicId,
        recordType: "pillar_strategy",
        title: "Pillar Strategy V1",
        content: "Original content",
      });
      expect(v1.approvalStatus).toBe("draft");
      expect(v1.versionNumber).toBe(1);

      // Approve v1.
      const v1Approved = await records.updateApprovalStatus(v1.id, "draft", "approved", null);
      expect(v1Approved.outcome).toBe("updated");
      expect(v1Approved.outcome === "updated" && v1Approved.entity.approvalStatus).toBe("approved");

      // Editing an APPROVED current version creates a new version (the service layer's own
      // real behavior, exercised here directly at the repository layer the same way
      // WebsiteStrategyRecordsService.update() composes it).
      const v2 = await withTransaction(async (transaction) => {
        await records.updateInPlace(v1.id, { isCurrent: false }, transaction);
        return records.createNewVersion(
          {
            recordId: v1.recordId,
            publicId,
            recordType: "pillar_strategy",
            versionNumber: 2,
            title: "Pillar Strategy V2 (revised)",
            content: "Revised content",
            notes: null,
          },
          transaction,
        );
      });
      expect(v2.approvalStatus).toBe("draft");
      expect(v2.versionNumber).toBe(2);
      expect(v2.isCurrent).toBe(true);

      // Exactly 2 rows now exist for this record.
      const allVersions = await records.listVersions(v1.recordId);
      expect(allVersions.length).toBe(2);

      // v1 is no longer current, but it is STILL approved (nothing has superseded it yet) —
      // "preserve versions" holds: it's still readable, not deleted.
      const v1AfterFlip = allVersions.find((r) => r.id === v1.id);
      expect(v1AfterFlip?.isCurrent).toBe(false);
      expect(v1AfterFlip?.approvalStatus).toBe("approved");

      // Approve v2 — the SAME transaction that approves v2 also supersedes v1 (task package D4),
      // mirroring WebsiteStrategyRecordsService.changeApprovalStatus()'s own composition.
      await withTransaction(async (transaction) => {
        const casResult = await records.updateApprovalStatus(
          v2.id,
          "draft",
          "approved",
          null,
          transaction,
        );
        expect(casResult.outcome).toBe("updated");
        await records.supersedeOtherApprovedVersion(v1.recordId, v2.id, null, transaction);
      });

      const finalVersions = await records.listVersions(v1.recordId);
      const finalV1 = finalVersions.find((r) => r.id === v1.id);
      const finalV2 = finalVersions.find((r) => r.id === v2.id);
      expect(finalV1?.approvalStatus).toBe("superseded");
      expect(finalV2?.approvalStatus).toBe("approved");
      expect(finalV2?.isCurrent).toBe(true);
      expect(finalV1?.isCurrent).toBe(false);

      // The current version resolves to v2.
      const current = await records.findCurrentByRecordId(v1.recordId);
      expect(current?.id).toBe(v2.id);
    });

    it("supersedeOtherApprovedVersion is a safe no-op when no other approved version exists (a record's first-ever approval)", async () => {
      const created = await records.create({
        publicId: uniqueId("WSC-FIRST"),
        recordType: "conversion_plan",
        title: "First Approval Fixture",
      });
      await withTransaction(async (transaction) => {
        const casResult = await records.updateApprovalStatus(
          created.id,
          "draft",
          "approved",
          null,
          transaction,
        );
        expect(casResult.outcome).toBe("updated");
        // No other row exists for this recordId — must not throw.
        await expect(
          records.supersedeOtherApprovedVersion(created.recordId, created.id, null, transaction),
        ).resolves.not.toThrow();
      });

      const current = await records.findCurrentByRecordId(created.recordId);
      expect(current?.approvalStatus).toBe("approved");
    });
  });

  describe("updateInPlace — CAS guard on approvalStatus (code-review fix)", () => {
    it("writes normally when expectedApprovalStatus matches the row's real current status", async () => {
      const created = await records.create({
        publicId: uniqueId("WSC-CAS-OK"),
        recordType: "search_plan",
        title: "CAS guard fixture",
      });

      const updated = await records.updateInPlace(
        created.id,
        { title: "Renamed via matching CAS" },
        undefined,
        "draft",
      );

      expect(updated?.title).toBe("Renamed via matching CAS");
    });

    it("is a real, DB-enforced no-op (returns null, writes nothing) when expectedApprovalStatus no longer matches the row's real current status", async () => {
      const created = await records.create({
        publicId: uniqueId("WSC-CAS-RACE"),
        recordType: "search_plan",
        title: "Original title",
      });
      // Simulate a concurrent approval landing between a caller's read and its write.
      const approved = await records.updateApprovalStatus(created.id, "draft", "approved", null);
      expect(approved.outcome).toBe("updated");

      // The caller still believes the row is "draft" (a stale read) and tries to edit it in place.
      const result = await records.updateInPlace(
        created.id,
        { title: "Should never land" },
        undefined,
        "draft",
      );

      expect(result).toBeNull();
      const stillApproved = await records.findCurrentByRecordId(created.recordId);
      expect(stillApproved?.title).toBe("Original title");
      expect(stillApproved?.approvalStatus).toBe("approved");
    });
  });

  it("cascades no rows on delete (no hard-delete exists — a real DELETE at the SQL layer removes only the targeted row, proving no unintended FK/cascade side effect exists on this single-table schema)", async () => {
    const created = await records.create({
      publicId: uniqueId("WSC-DEL"),
      recordType: "navigation_plan",
      title: "Delete Fixture",
    });
    await getConnection().query("DELETE FROM website_strategy_records WHERE id = :id", {
      replacements: { id: created.id },
    });
    expect(await records.findCurrentByRecordId(created.recordId)).toBeNull();
  });
});
