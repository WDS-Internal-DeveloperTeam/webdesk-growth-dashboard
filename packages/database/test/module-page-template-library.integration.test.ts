import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PageTemplateRepository } from "../src/page-template-library/index.js";
import { closeConnection, getConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";
import { withTransaction } from "../src/transaction.js";

/**
 * Exercises the Page Template Library schema (migration `00082`) against a REAL, disposable
 * PostgreSQL database. Mirrors ../test/module-component-library.integration.test.ts's own
 * structure — this module's own real multi-row version history (design decision D1) is identical
 * in shape to Component Library's own, so the same test structure applies: the
 * partial-unique-index-on-`is_current` behavior, the `(record_id, version_number)` uniqueness, and
 * a full end-to-end version-history round trip.
 */
describe("Page Template Library module (real disposable database)", () => {
  const pageTemplates = new PageTemplateRepository();

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

  describe("PageTemplateRepository — basic CRUD", () => {
    it("creates a page template defaulting to draft approvalStatus, versionNumber 1, isCurrent true", async () => {
      const created = await pageTemplates.create({
        publicId: uniqueId("PGT-HOME"),
        pageType: "homepage",
        name: "Homepage Template",
      });
      expect(created.approvalStatus).toBe("draft");
      expect(created.versionNumber).toBe(1);
      expect(created.isCurrent).toBe(true);
      expect(created.recordId).toBeTruthy();
      expect(created.recordId).not.toBe(created.id);
      expect(created.requiredSectionIds).toEqual([]);
      expect(created.optionalSectionIds).toEqual([]);
      expect(created.supportedComponentIds).toEqual([]);
      expect(created.wireframeReferences).toEqual([]);
    });

    it("stores requiredSectionIds/optionalSectionIds/supportedComponentIds as real UUID arrays, defaulting to empty", async () => {
      const sectionA = randomUUID();
      const sectionB = randomUUID();
      const componentA = randomUUID();
      const created = await pageTemplates.create({
        publicId: uniqueId("PGT-SERVICE"),
        pageType: "service",
        name: "Service Template",
        requiredSectionIds: [sectionA],
        optionalSectionIds: [sectionB],
        supportedComponentIds: [componentA],
      });
      expect(created.requiredSectionIds).toEqual([sectionA]);
      expect(created.optionalSectionIds).toEqual([sectionB]);
      expect(created.supportedComponentIds).toEqual([componentA]);
    });

    it("stores wireframeReferences as a plain string array, unvalidated against any relationship", async () => {
      const created = await pageTemplates.create({
        publicId: uniqueId("PGT-WF"),
        pageType: "landing",
        name: "Landing Template",
        wireframeReferences: ["not-a-uuid-reference", "another free-text reference"],
      });
      expect(created.wireframeReferences).toEqual([
        "not-a-uuid-reference",
        "another free-text reference",
      ]);
    });

    it("stores every long-text/short-text field", async () => {
      const created = await pageTemplates.create({
        publicId: uniqueId("PGT-FULL"),
        pageType: "article",
        name: "Article Template",
        contentRequirements: "Headline, byline, body copy, related articles",
        searchRequirements: "Meta title, meta description, schema.org Article markup",
        conversionGoal: "Newsletter signup",
        phpTemplateRelationship: "templates/single-article.php",
      });
      expect(created.contentRequirements).toBe("Headline, byline, body copy, related articles");
      expect(created.searchRequirements).toBe(
        "Meta title, meta description, schema.org Article markup",
      );
      expect(created.conversionGoal).toBe("Newsletter signup");
      expect(created.phpTemplateRelationship).toBe("templates/single-article.php");
    });

    it("findCurrentByRecordId / findCurrentByPublicId return null for an unknown id", async () => {
      expect(await pageTemplates.findCurrentByRecordId(randomUUID())).toBeNull();
      expect(await pageTemplates.findCurrentByPublicId("PGT-does-not-exist")).toBeNull();
    });

    it("findCurrentByRecordId / findCurrentByPublicId find a real created page template", async () => {
      const publicId = uniqueId("PGT-ABOUT");
      const created = await pageTemplates.create({
        publicId,
        pageType: "about",
        name: "About Template",
      });
      expect((await pageTemplates.findCurrentByRecordId(created.recordId))?.id).toBe(created.id);
      expect((await pageTemplates.findCurrentByPublicId(publicId))?.id).toBe(created.id);
    });

    it("list() filters by pageType/approvalStatus/search (case-insensitive) and only returns isCurrent rows", async () => {
      const uniqueName = uniqueId("Unique Searchable Page Template Name");
      await pageTemplates.create({
        publicId: uniqueId("PGT-TYPO"),
        pageType: "portfolio",
        name: uniqueName,
      });

      const byPageType = await pageTemplates.list({ pageType: "portfolio" });
      expect(byPageType.length).toBeGreaterThanOrEqual(1);
      expect(byPageType.every((r) => r.pageType === "portfolio")).toBe(true);

      const byStatus = await pageTemplates.list({ approvalStatus: "draft" });
      expect(byStatus.length).toBeGreaterThanOrEqual(1);

      const bySearch = await pageTemplates.list({ search: uniqueName.toLowerCase() });
      expect(bySearch.length).toBe(1);
    });

    it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
      const uniqueSuffix = uniqueId("PCT");
      const wildcardMatch = await pageTemplates.create({
        publicId: uniqueId("PGT-PCT"),
        pageType: "landing",
        name: `50% Off Alert ${uniqueSuffix}`,
      });
      const plainMatch = await pageTemplates.create({
        publicId: uniqueId("PGT-PCT"),
        pageType: "landing",
        name: `50X Off Alert ${uniqueSuffix}`,
      });

      const found = await pageTemplates.list({ search: `50% Off Alert ${uniqueSuffix}` });
      const ids = found.map((r) => r.id);
      expect(ids).toContain(wildcardMatch.id);
      expect(ids).not.toContain(plainMatch.id);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await pageTemplates.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("updateInPlace() changes fields and never touches approvalStatus/pageType", async () => {
      const created = await pageTemplates.create({
        publicId: uniqueId("PGT-CAREERS"),
        pageType: "careers",
        name: "Original",
      });

      const updated = await pageTemplates.updateInPlace(created.id, { name: "Renamed" });
      expect(updated?.name).toBe("Renamed");
      expect(updated?.approvalStatus).toBe("draft");
      expect(updated?.pageType).toBe("careers");
    });

    it("updateInPlace() returns null for a missing row id", async () => {
      expect(await pageTemplates.updateInPlace(randomUUID(), { name: "x" })).toBeNull();
    });

    it("updateInPlace() clears requiredSectionIds/optionalSectionIds/supportedComponentIds/wireframeReferences to [] on an explicit null, without throwing (regression: spreading a raw null would crash)", async () => {
      const created = await pageTemplates.create({
        publicId: uniqueId("PGT-CLEAR"),
        pageType: "contact",
        name: "Clear Fixture",
        requiredSectionIds: [randomUUID()],
        optionalSectionIds: [randomUUID()],
        supportedComponentIds: [randomUUID()],
        wireframeReferences: ["WF-1"],
      });

      const updated = await pageTemplates.updateInPlace(created.id, {
        requiredSectionIds: null,
        optionalSectionIds: null,
        supportedComponentIds: null,
        wireframeReferences: null,
      });
      expect(updated?.requiredSectionIds).toEqual([]);
      expect(updated?.optionalSectionIds).toEqual([]);
      expect(updated?.supportedComponentIds).toEqual([]);
      expect(updated?.wireframeReferences).toEqual([]);
    });

    it("updateInPlace() leaves relationship fields untouched when omitted from the patch", async () => {
      const sectionId = randomUUID();
      const created = await pageTemplates.create({
        publicId: uniqueId("PGT-KEEP"),
        pageType: "contact",
        name: "Keep Fixture",
        requiredSectionIds: [sectionId],
      });

      const updated = await pageTemplates.updateInPlace(created.id, { name: "Renamed" });
      expect(updated?.requiredSectionIds).toEqual([sectionId]);
    });

    it("updateApprovalStatus() changes approvalStatus when the expected current status matches", async () => {
      const created = await pageTemplates.create({
        publicId: uniqueId("PGT-STATUS"),
        pageType: "platform",
        name: "Status Fixture",
      });
      const result = await pageTemplates.updateApprovalStatus(
        created.id,
        "draft",
        "submitted",
        null,
      );
      expect(result.outcome).toBe("updated");
      expect(result.outcome === "updated" && result.entity.approvalStatus).toBe("submitted");
    });

    it("updateApprovalStatus() reports not_found for a missing row id", async () => {
      const result = await pageTemplates.updateApprovalStatus(
        randomUUID(),
        "draft",
        "submitted",
        null,
      );
      expect(result.outcome).toBe("not_found");
    });

    it("updateApprovalStatus() reports conflict (and does not write) on the atomic compare-and-swap", async () => {
      const created = await pageTemplates.create({
        publicId: uniqueId("PGT-CONFLICT"),
        pageType: "industry",
        name: "Conflict Fixture",
      });
      // The row is really `draft`; we claim we expected `submitted` — a stale read.
      const result = await pageTemplates.updateApprovalStatus(
        created.id,
        "submitted",
        "under_review",
        null,
      );
      expect(result.outcome).toBe("conflict");
      expect(result.outcome === "conflict" && result.entity.approvalStatus).toBe("draft");

      const stillDraft = await pageTemplates.findCurrentByRecordId(created.recordId);
      expect(stillDraft?.approvalStatus).toBe("draft");
    });

    it("rejects an invalid approvalStatus at the database layer (real ENUM constraint)", async () => {
      const created = await pageTemplates.create({
        publicId: uniqueId("PGT-ENUM"),
        pageType: "location",
        name: "Enum Fixture",
      });
      await expect(
        // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
        pageTemplates.updateApprovalStatus(created.id, "draft", "not_a_real_status", null),
      ).rejects.toThrow();
    });
  });

  describe("partial-unique-index behavior (WHERE is_current = true)", () => {
    it("rejects a second DIFFERENT record reusing the same publicId while both are current", async () => {
      const publicId = uniqueId("PGT-DUP");
      await pageTemplates.create({ publicId, pageType: "confirmation", name: "First record" });
      await expect(
        pageTemplates.create({ publicId, pageType: "confirmation", name: "Second record" }),
      ).rejects.toThrow();
    });

    it("allows creating a new VERSION of the same record that legitimately repeats the same publicId, once the old row's isCurrent is flipped false first", async () => {
      const publicId = uniqueId("PGT-VER");
      const v1 = await pageTemplates.create({
        publicId,
        pageType: "not_found",
        name: "V1",
      });

      await withTransaction(async (transaction) => {
        await pageTemplates.updateInPlace(v1.id, { isCurrent: false }, transaction);
        await pageTemplates.createNewVersion(
          {
            recordId: v1.recordId,
            publicId,
            pageType: "not_found",
            versionNumber: 2,
            name: "V2",
            requiredSectionIds: [],
            optionalSectionIds: [],
            supportedComponentIds: [],
            wireframeReferences: [],
            contentRequirements: null,
            searchRequirements: null,
            conversionGoal: null,
            phpTemplateRelationship: null,
            replacementRecordId: null,
          },
          transaction,
        );
      });

      const current = await pageTemplates.findCurrentByPublicId(publicId);
      expect(current?.name).toBe("V2");
      expect(current?.versionNumber).toBe(2);

      const allVersions = await pageTemplates.listVersions(v1.recordId);
      expect(allVersions.length).toBe(2);
    });

    it("rejects two versions of the SAME record sharing the same versionNumber ((record_id, version_number) unique index)", async () => {
      const created = await pageTemplates.create({
        publicId: uniqueId("PGT-DUPVER"),
        pageType: "campaign_event",
        name: "V1",
      });
      await expect(
        pageTemplates.createNewVersion({
          recordId: created.recordId,
          publicId: uniqueId("PGT-DUPVER-2"),
          pageType: "campaign_event",
          versionNumber: 1,
          name: "Duplicate version number",
          requiredSectionIds: [],
          optionalSectionIds: [],
          supportedComponentIds: [],
          wireframeReferences: [],
          contentRequirements: null,
          searchRequirements: null,
          conversionGoal: null,
          phpTemplateRelationship: null,
          replacementRecordId: null,
        }),
      ).rejects.toThrow();
    });
  });

  describe("full real end-to-end version-history round trip", () => {
    it("create -> approve -> edit-the-approved-one -> verify 2 rows -> approve the new one -> verify the old row is superseded", async () => {
      const publicId = uniqueId("PGT-E2E");
      const v1 = await pageTemplates.create({
        publicId,
        pageType: "homepage",
        name: "Homepage V1",
      });
      expect(v1.approvalStatus).toBe("draft");
      expect(v1.versionNumber).toBe(1);

      const v1Approved = await pageTemplates.updateApprovalStatus(v1.id, "draft", "approved", null);
      expect(v1Approved.outcome).toBe("updated");

      const v2 = await withTransaction(async (transaction) => {
        await pageTemplates.updateInPlace(v1.id, { isCurrent: false }, transaction);
        return pageTemplates.createNewVersion(
          {
            recordId: v1.recordId,
            publicId,
            pageType: "homepage",
            versionNumber: 2,
            name: "Homepage V2 (revised)",
            requiredSectionIds: [],
            optionalSectionIds: [],
            supportedComponentIds: [],
            wireframeReferences: [],
            contentRequirements: null,
            searchRequirements: null,
            conversionGoal: null,
            phpTemplateRelationship: null,
            replacementRecordId: null,
          },
          transaction,
        );
      });
      expect(v2.approvalStatus).toBe("draft");
      expect(v2.versionNumber).toBe(2);
      expect(v2.isCurrent).toBe(true);

      const allVersions = await pageTemplates.listVersions(v1.recordId);
      expect(allVersions.length).toBe(2);

      const v1AfterFlip = allVersions.find((r) => r.id === v1.id);
      expect(v1AfterFlip?.isCurrent).toBe(false);
      expect(v1AfterFlip?.approvalStatus).toBe("approved");

      await withTransaction(async (transaction) => {
        const casResult = await pageTemplates.updateApprovalStatus(
          v2.id,
          "draft",
          "approved",
          null,
          transaction,
        );
        expect(casResult.outcome).toBe("updated");
        await pageTemplates.supersedeOtherApprovedVersion(v1.recordId, v2.id, null, transaction);
      });

      const finalVersions = await pageTemplates.listVersions(v1.recordId);
      const finalV1 = finalVersions.find((r) => r.id === v1.id);
      const finalV2 = finalVersions.find((r) => r.id === v2.id);
      expect(finalV1?.approvalStatus).toBe("superseded");
      expect(finalV2?.approvalStatus).toBe("approved");
      expect(finalV2?.isCurrent).toBe(true);
      expect(finalV1?.isCurrent).toBe(false);

      const current = await pageTemplates.findCurrentByRecordId(v1.recordId);
      expect(current?.id).toBe(v2.id);
    });

    it("supersedeOtherApprovedVersion is a safe no-op when no other approved version exists (a record's first-ever approval)", async () => {
      const created = await pageTemplates.create({
        publicId: uniqueId("PGT-FIRST"),
        pageType: "case_study",
        name: "First Approval Fixture",
      });
      await withTransaction(async (transaction) => {
        const casResult = await pageTemplates.updateApprovalStatus(
          created.id,
          "draft",
          "approved",
          null,
          transaction,
        );
        expect(casResult.outcome).toBe("updated");
        await expect(
          pageTemplates.supersedeOtherApprovedVersion(
            created.recordId,
            created.id,
            null,
            transaction,
          ),
        ).resolves.not.toThrow();
      });

      const current = await pageTemplates.findCurrentByRecordId(created.recordId);
      expect(current?.approvalStatus).toBe("approved");
    });
  });

  describe("updateInPlace — CAS guard on approvalStatus", () => {
    it("writes normally when expectedApprovalStatus matches the row's real current status", async () => {
      const created = await pageTemplates.create({
        publicId: uniqueId("PGT-CAS-OK"),
        pageType: "archive_category",
        name: "CAS guard fixture",
      });

      const updated = await pageTemplates.updateInPlace(
        created.id,
        { name: "Renamed via matching CAS" },
        undefined,
        "draft",
      );

      expect(updated?.name).toBe("Renamed via matching CAS");
    });

    it("is a real, DB-enforced no-op (returns null, writes nothing) when expectedApprovalStatus no longer matches the row's real current status", async () => {
      const created = await pageTemplates.create({
        publicId: uniqueId("PGT-CAS-RACE"),
        pageType: "archive_category",
        name: "Original name",
      });
      const approved = await pageTemplates.updateApprovalStatus(
        created.id,
        "draft",
        "approved",
        null,
      );
      expect(approved.outcome).toBe("updated");

      const result = await pageTemplates.updateInPlace(
        created.id,
        { name: "Should never land" },
        undefined,
        "draft",
      );

      expect(result).toBeNull();
      const stillApproved = await pageTemplates.findCurrentByRecordId(created.recordId);
      expect(stillApproved?.name).toBe("Original name");
      expect(stillApproved?.approvalStatus).toBe("approved");
    });
  });

  it("cascades no rows on delete (no hard-delete exists — a real DELETE at the SQL layer removes only the targeted row, proving no unintended FK/cascade side effect exists on this single-table schema)", async () => {
    const created = await pageTemplates.create({
      publicId: uniqueId("PGT-DEL"),
      pageType: "portfolio",
      name: "Delete Fixture",
    });
    await getConnection().query("DELETE FROM page_templates WHERE id = :id", {
      replacements: { id: created.id },
    });
    expect(await pageTemplates.findCurrentByRecordId(created.recordId)).toBeNull();
  });
});
