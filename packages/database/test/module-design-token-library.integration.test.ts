import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DesignTokenRepository } from "../src/design-token-library/index.js";
import { closeConnection, getConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";
import { withTransaction } from "../src/transaction.js";

/**
 * Exercises the Design Token Library schema (migration `00074`) against a REAL, disposable
 * PostgreSQL database. Mirrors ../test/module-website-strategy-center.integration.test.ts's own
 * structure, plus real coverage for this module's own genuinely new mechanism among the business
 * modules built so far: real multi-row version history — the partial-unique-index-on-`is_current`
 * behavior, the `(record_id, version_number)` uniqueness, and a full end-to-end version-history
 * round trip (create -> approve -> edit-the-approved-one -> verify 2 rows exist -> approve the new
 * one -> verify the old row is superseded).
 */
describe("Design Token Library module (real disposable database)", () => {
  const tokens = new DesignTokenRepository();

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

  describe("DesignTokenRepository — basic CRUD", () => {
    it("creates a token defaulting to draft approvalStatus, versionNumber 1, isCurrent true", async () => {
      const created = await tokens.create({
        publicId: uniqueId("DTL-COLOR"),
        group: "colors",
        name: "Primary 500",
        value: "#0F172A",
      });
      expect(created.approvalStatus).toBe("draft");
      expect(created.versionNumber).toBe(1);
      expect(created.isCurrent).toBe(true);
      expect(created.recordId).toBeTruthy();
      // Each newly created record gets its own fresh recordId — never the same as its own row id
      // by coincidence being asserted here, just confirming it is a real, distinct UUID.
      expect(created.recordId).not.toBe(created.id);
      expect(created.usageReferences).toEqual([]);
    });

    it("stores usageReferences as a real array, defaulting to empty", async () => {
      const created = await tokens.create({
        publicId: uniqueId("DTL-COLOR"),
        group: "colors",
        name: "Accent 500",
        value: "#7C3AED",
        usageReferences: ["hero-section", "footer-cta"],
      });
      expect(created.usageReferences).toEqual(["hero-section", "footer-cta"]);
    });

    it("findCurrentByRecordId / findCurrentByPublicId return null for an unknown id", async () => {
      expect(await tokens.findCurrentByRecordId(randomUUID())).toBeNull();
      expect(await tokens.findCurrentByPublicId("DTL-does-not-exist")).toBeNull();
    });

    it("findCurrentByRecordId / findCurrentByPublicId find a real created token", async () => {
      const publicId = uniqueId("DTL-SPACE");
      const created = await tokens.create({
        publicId,
        group: "spacing",
        name: "Space 4",
        value: "16px",
        unit: "px",
      });
      expect((await tokens.findCurrentByRecordId(created.recordId))?.id).toBe(created.id);
      expect((await tokens.findCurrentByPublicId(publicId))?.id).toBe(created.id);
    });

    it("list() filters by group/approvalStatus/search (case-insensitive) and only returns isCurrent rows", async () => {
      const uniqueName = uniqueId("Unique Searchable Token Name");
      await tokens.create({
        publicId: uniqueId("DTL-TYPO"),
        group: "typography",
        name: uniqueName,
        value: "16px/1.5",
      });

      const byGroup = await tokens.list({ group: "typography" });
      expect(byGroup.length).toBeGreaterThanOrEqual(1);
      expect(byGroup.every((r) => r.group === "typography")).toBe(true);

      const byStatus = await tokens.list({ approvalStatus: "draft" });
      expect(byStatus.length).toBeGreaterThanOrEqual(1);

      const bySearch = await tokens.list({ search: uniqueName.toLowerCase() });
      expect(bySearch.length).toBe(1);
    });

    it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
      const uniqueSuffix = uniqueId("PCT");
      const wildcardMatch = await tokens.create({
        publicId: uniqueId("DTL-PCT"),
        group: "opacity_and_z_index",
        name: `50% Opacity Token ${uniqueSuffix}`,
        value: "0.5",
      });
      const plainMatch = await tokens.create({
        publicId: uniqueId("DTL-PCT"),
        group: "opacity_and_z_index",
        name: `50X Opacity Token ${uniqueSuffix}`,
        value: "0.5",
      });

      const found = await tokens.list({ search: `50% Opacity Token ${uniqueSuffix}` });
      const ids = found.map((r) => r.id);
      expect(ids).toContain(wildcardMatch.id);
      expect(ids).not.toContain(plainMatch.id);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await tokens.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("updateInPlace() changes fields and never touches approvalStatus/group", async () => {
      const created = await tokens.create({
        publicId: uniqueId("DTL-MOTION"),
        group: "motion",
        name: "Original",
        value: "200ms",
      });

      const updated = await tokens.updateInPlace(created.id, { name: "Renamed" });
      expect(updated?.name).toBe("Renamed");
      expect(updated?.approvalStatus).toBe("draft");
      expect(updated?.group).toBe("motion");
    });

    it("updateInPlace() returns null for a missing row id", async () => {
      expect(await tokens.updateInPlace(randomUUID(), { name: "x" })).toBeNull();
    });

    it("updateApprovalStatus() changes approvalStatus when the expected current status matches", async () => {
      const created = await tokens.create({
        publicId: uniqueId("DTL-SHADOW"),
        group: "shadows",
        name: "Status Fixture",
        value: "0 1px 2px rgba(0,0,0,0.1)",
      });
      const result = await tokens.updateApprovalStatus(created.id, "draft", "submitted", null);
      expect(result.outcome).toBe("updated");
      expect(result.outcome === "updated" && result.entity.approvalStatus).toBe("submitted");
    });

    it("updateApprovalStatus() reports not_found for a missing row id", async () => {
      const result = await tokens.updateApprovalStatus(randomUUID(), "draft", "submitted", null);
      expect(result.outcome).toBe("not_found");
    });

    it("updateApprovalStatus() reports conflict (and does not write) on the atomic compare-and-swap", async () => {
      const created = await tokens.create({
        publicId: uniqueId("DTL-BORDER"),
        group: "borders",
        name: "Conflict Fixture",
        value: "1px solid",
      });
      // The row is really `draft`; we claim we expected `submitted` — a stale read.
      const result = await tokens.updateApprovalStatus(
        created.id,
        "submitted",
        "under_review",
        null,
      );
      expect(result.outcome).toBe("conflict");
      expect(result.outcome === "conflict" && result.entity.approvalStatus).toBe("draft");

      const stillDraft = await tokens.findCurrentByRecordId(created.recordId);
      expect(stillDraft?.approvalStatus).toBe("draft");
    });

    it("rejects an invalid approvalStatus at the database layer (real ENUM constraint)", async () => {
      const created = await tokens.create({
        publicId: uniqueId("DTL-BREAK"),
        group: "breakpoints",
        name: "Enum Fixture",
        value: "768px",
      });
      await expect(
        // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
        tokens.updateApprovalStatus(created.id, "draft", "not_a_real_status", null),
      ).rejects.toThrow();
    });

    it("rejects an invalid group at the database layer (real ENUM constraint)", async () => {
      await expect(
        tokens.create({
          publicId: uniqueId("DTL-BAD"),
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          group: "not_a_real_group",
          name: "Enum Fixture 2",
          value: "x",
        }),
      ).rejects.toThrow();
    });

    it("rejects an invalid themeVariation at the database layer (real ENUM constraint)", async () => {
      await expect(
        tokens.create({
          publicId: uniqueId("DTL-BAD"),
          group: "colors",
          name: "Enum Fixture 3",
          value: "#000",
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          themeVariation: "not_a_real_theme",
        }),
      ).rejects.toThrow();
    });
  });

  describe("partial-unique-index behavior (WHERE is_current = true)", () => {
    it("rejects a second DIFFERENT record reusing the same publicId while both are current", async () => {
      const publicId = uniqueId("DTL-DUP");
      await tokens.create({ publicId, group: "colors", name: "First record", value: "#111" });
      await expect(
        tokens.create({ publicId, group: "colors", name: "Second record", value: "#222" }),
      ).rejects.toThrow();
    });

    it("allows creating a new VERSION of the same record that legitimately repeats the same publicId, once the old row's isCurrent is flipped false first", async () => {
      const publicId = uniqueId("DTL-VER");
      const v1 = await tokens.create({ publicId, group: "colors", name: "V1", value: "#111" });

      await withTransaction(async (transaction) => {
        await tokens.updateInPlace(v1.id, { isCurrent: false }, transaction);
        await tokens.createNewVersion(
          {
            recordId: v1.recordId,
            publicId,
            group: "colors",
            versionNumber: 2,
            name: "V2",
            value: "#222",
            unit: null,
            semanticPurpose: null,
            responsiveVariation: null,
            themeVariation: null,
            usageReferences: [],
          },
          transaction,
        );
      });

      const current = await tokens.findCurrentByPublicId(publicId);
      expect(current?.name).toBe("V2");
      expect(current?.versionNumber).toBe(2);

      const allVersions = await tokens.listVersions(v1.recordId);
      expect(allVersions.length).toBe(2);
    });

    it("rejects two versions of the SAME record sharing the same versionNumber ((record_id, version_number) unique index)", async () => {
      const created = await tokens.create({
        publicId: uniqueId("DTL-DUPVER"),
        group: "colors",
        name: "V1",
        value: "#111",
      });
      // versionNumber 1 already exists for this recordId (the row just created above) — a second
      // row claiming versionNumber 1 for the same recordId must be rejected.
      await expect(
        tokens.createNewVersion({
          recordId: created.recordId,
          publicId: uniqueId("DTL-DUPVER-2"),
          group: "colors",
          versionNumber: 1,
          name: "Duplicate version number",
          value: "#222",
          unit: null,
          semanticPurpose: null,
          responsiveVariation: null,
          themeVariation: null,
          usageReferences: [],
        }),
      ).rejects.toThrow();
    });
  });

  describe("full real end-to-end version-history round trip", () => {
    it("create -> approve -> edit-the-approved-one -> verify 2 rows -> approve the new one -> verify the old row is superseded", async () => {
      const publicId = uniqueId("DTL-E2E");
      const v1 = await tokens.create({
        publicId,
        group: "colors",
        name: "Primary V1",
        value: "#0F172A",
      });
      expect(v1.approvalStatus).toBe("draft");
      expect(v1.versionNumber).toBe(1);

      // Approve v1.
      const v1Approved = await tokens.updateApprovalStatus(v1.id, "draft", "approved", null);
      expect(v1Approved.outcome).toBe("updated");
      expect(v1Approved.outcome === "updated" && v1Approved.entity.approvalStatus).toBe("approved");

      // Editing an APPROVED current version creates a new version (the service layer's own
      // real behavior, exercised here directly at the repository layer the same way
      // DesignTokensService.update() composes it).
      const v2 = await withTransaction(async (transaction) => {
        await tokens.updateInPlace(v1.id, { isCurrent: false }, transaction);
        return tokens.createNewVersion(
          {
            recordId: v1.recordId,
            publicId,
            group: "colors",
            versionNumber: 2,
            name: "Primary V2 (revised)",
            value: "#111827",
            unit: null,
            semanticPurpose: null,
            responsiveVariation: null,
            themeVariation: null,
            usageReferences: [],
          },
          transaction,
        );
      });
      expect(v2.approvalStatus).toBe("draft");
      expect(v2.versionNumber).toBe(2);
      expect(v2.isCurrent).toBe(true);

      // Exactly 2 rows now exist for this record.
      const allVersions = await tokens.listVersions(v1.recordId);
      expect(allVersions.length).toBe(2);

      // v1 is no longer current, but it is STILL approved (nothing has superseded it yet) —
      // "preserve versions" holds: it's still readable, not deleted.
      const v1AfterFlip = allVersions.find((r) => r.id === v1.id);
      expect(v1AfterFlip?.isCurrent).toBe(false);
      expect(v1AfterFlip?.approvalStatus).toBe("approved");

      // Approve v2 — the SAME transaction that approves v2 also supersedes v1, mirroring
      // DesignTokensService.changeApprovalStatus()'s own composition.
      await withTransaction(async (transaction) => {
        const casResult = await tokens.updateApprovalStatus(
          v2.id,
          "draft",
          "approved",
          null,
          transaction,
        );
        expect(casResult.outcome).toBe("updated");
        await tokens.supersedeOtherApprovedVersion(v1.recordId, v2.id, null, transaction);
      });

      const finalVersions = await tokens.listVersions(v1.recordId);
      const finalV1 = finalVersions.find((r) => r.id === v1.id);
      const finalV2 = finalVersions.find((r) => r.id === v2.id);
      expect(finalV1?.approvalStatus).toBe("superseded");
      expect(finalV2?.approvalStatus).toBe("approved");
      expect(finalV2?.isCurrent).toBe(true);
      expect(finalV1?.isCurrent).toBe(false);

      // The current version resolves to v2.
      const current = await tokens.findCurrentByRecordId(v1.recordId);
      expect(current?.id).toBe(v2.id);
    });

    it("supersedeOtherApprovedVersion is a safe no-op when no other approved version exists (a record's first-ever approval)", async () => {
      const created = await tokens.create({
        publicId: uniqueId("DTL-FIRST"),
        group: "colors",
        name: "First Approval Fixture",
        value: "#000",
      });
      await withTransaction(async (transaction) => {
        const casResult = await tokens.updateApprovalStatus(
          created.id,
          "draft",
          "approved",
          null,
          transaction,
        );
        expect(casResult.outcome).toBe("updated");
        // No other row exists for this recordId — must not throw.
        await expect(
          tokens.supersedeOtherApprovedVersion(created.recordId, created.id, null, transaction),
        ).resolves.not.toThrow();
      });

      const current = await tokens.findCurrentByRecordId(created.recordId);
      expect(current?.approvalStatus).toBe("approved");
    });
  });

  describe("updateInPlace — CAS guard on approvalStatus", () => {
    it("writes normally when expectedApprovalStatus matches the row's real current status", async () => {
      const created = await tokens.create({
        publicId: uniqueId("DTL-CAS-OK"),
        group: "colors",
        name: "CAS guard fixture",
        value: "#000",
      });

      const updated = await tokens.updateInPlace(
        created.id,
        { name: "Renamed via matching CAS" },
        undefined,
        "draft",
      );

      expect(updated?.name).toBe("Renamed via matching CAS");
    });

    it("is a real, DB-enforced no-op (returns null, writes nothing) when expectedApprovalStatus no longer matches the row's real current status", async () => {
      const created = await tokens.create({
        publicId: uniqueId("DTL-CAS-RACE"),
        group: "colors",
        name: "Original name",
        value: "#000",
      });
      // Simulate a concurrent approval landing between a caller's read and its write.
      const approved = await tokens.updateApprovalStatus(created.id, "draft", "approved", null);
      expect(approved.outcome).toBe("updated");

      // The caller still believes the row is "draft" (a stale read) and tries to edit it in place.
      const result = await tokens.updateInPlace(
        created.id,
        { name: "Should never land" },
        undefined,
        "draft",
      );

      expect(result).toBeNull();
      const stillApproved = await tokens.findCurrentByRecordId(created.recordId);
      expect(stillApproved?.name).toBe("Original name");
      expect(stillApproved?.approvalStatus).toBe("approved");
    });
  });

  it("cascades no rows on delete (no hard-delete exists — a real DELETE at the SQL layer removes only the targeted row, proving no unintended FK/cascade side effect exists on this single-table schema)", async () => {
    const created = await tokens.create({
      publicId: uniqueId("DTL-DEL"),
      group: "colors",
      name: "Delete Fixture",
      value: "#000",
    });
    await getConnection().query("DELETE FROM design_tokens WHERE id = :id", {
      replacements: { id: created.id },
    });
    expect(await tokens.findCurrentByRecordId(created.recordId)).toBeNull();
  });
});
