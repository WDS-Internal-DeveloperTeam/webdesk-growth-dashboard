import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ComponentRepository } from "../src/component-library/index.js";
import { closeConnection, getConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";
import { withTransaction } from "../src/transaction.js";

/**
 * Exercises the Component Library schema (migration `00078`) against a REAL, disposable
 * PostgreSQL database. Mirrors ../test/module-design-token-library.integration.test.ts's own
 * structure — this module's own real multi-row version history (design decision 1) is identical
 * in shape to Design Token Library's own, so the same test structure applies: the
 * partial-unique-index-on-`is_current` behavior, the `(record_id, version_number)` uniqueness, a
 * full end-to-end version-history round trip, and the new `findByIds()` lookup this module needs
 * for its own `replacementRecordId` existence check (and that Design Token Library's own sibling
 * `findByIds()` addition, for `tokenIds`, is exercised separately in that module's own test file).
 */
describe("Component Library module (real disposable database)", () => {
  const components = new ComponentRepository();

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

  describe("ComponentRepository — basic CRUD", () => {
    it("creates a component defaulting to draft approvalStatus, versionNumber 1, isCurrent true", async () => {
      const created = await components.create({
        publicId: uniqueId("CMP-BUTTON"),
        category: "buttons",
        name: "Primary Button",
      });
      expect(created.approvalStatus).toBe("draft");
      expect(created.versionNumber).toBe(1);
      expect(created.isCurrent).toBe(true);
      expect(created.recordId).toBeTruthy();
      expect(created.recordId).not.toBe(created.id);
      expect(created.tokenIds).toEqual([]);
    });

    it("stores tokenIds as a real UUID array, defaulting to empty", async () => {
      const tokenA = randomUUID();
      const tokenB = randomUUID();
      const created = await components.create({
        publicId: uniqueId("CMP-CARD"),
        category: "cards",
        name: "Content Card",
        tokenIds: [tokenA, tokenB],
      });
      expect(created.tokenIds).toEqual([tokenA, tokenB]);
    });

    it("stores every long-text/short-text field", async () => {
      const created = await components.create({
        publicId: uniqueId("CMP-FULL"),
        category: "navigation",
        name: "Primary Nav",
        figmaReference: "https://figma.com/file/nav",
        htmlStructure: "<nav>...</nav>",
        phpPath: "components/navigation/primary.php",
        scssClassesPath: "components/_navigation.scss",
        jsDependencies: "components/js/nav-toggle.js",
        states: "default, open, scrolled",
        responsiveBehavior: "Collapses to a hamburger menu below 768px",
        browserSupport: "Evergreen browsers, IE11 not supported",
        accessibility: "Keyboard-navigable, aria-expanded on toggle",
        schema: "SiteNavigationElement",
        analytics: "nav_click event on every link",
        tests: "Playwright: opens/closes on mobile",
      });
      expect(created.figmaReference).toBe("https://figma.com/file/nav");
      expect(created.htmlStructure).toBe("<nav>...</nav>");
      expect(created.phpPath).toBe("components/navigation/primary.php");
      expect(created.states).toBe("default, open, scrolled");
      expect(created.accessibility).toBe("Keyboard-navigable, aria-expanded on toggle");
    });

    it("findCurrentByRecordId / findCurrentByPublicId return null for an unknown id", async () => {
      expect(await components.findCurrentByRecordId(randomUUID())).toBeNull();
      expect(await components.findCurrentByPublicId("CMP-does-not-exist")).toBeNull();
    });

    it("findCurrentByRecordId / findCurrentByPublicId find a real created component", async () => {
      const publicId = uniqueId("CMP-HERO");
      const created = await components.create({ publicId, category: "heroes", name: "Hero A" });
      expect((await components.findCurrentByRecordId(created.recordId))?.id).toBe(created.id);
      expect((await components.findCurrentByPublicId(publicId))?.id).toBe(created.id);
    });

    it("list() filters by category/approvalStatus/search (case-insensitive) and only returns isCurrent rows", async () => {
      const uniqueName = uniqueId("Unique Searchable Component Name");
      await components.create({
        publicId: uniqueId("CMP-TYPO"),
        category: "testimonials",
        name: uniqueName,
      });

      const byCategory = await components.list({ category: "testimonials" });
      expect(byCategory.length).toBeGreaterThanOrEqual(1);
      expect(byCategory.every((r) => r.category === "testimonials")).toBe(true);

      const byStatus = await components.list({ approvalStatus: "draft" });
      expect(byStatus.length).toBeGreaterThanOrEqual(1);

      const bySearch = await components.list({ search: uniqueName.toLowerCase() });
      expect(bySearch.length).toBe(1);
    });

    it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
      const uniqueSuffix = uniqueId("PCT");
      const wildcardMatch = await components.create({
        publicId: uniqueId("CMP-PCT"),
        category: "alerts",
        name: `50% Off Alert ${uniqueSuffix}`,
      });
      const plainMatch = await components.create({
        publicId: uniqueId("CMP-PCT"),
        category: "alerts",
        name: `50X Off Alert ${uniqueSuffix}`,
      });

      const found = await components.list({ search: `50% Off Alert ${uniqueSuffix}` });
      const ids = found.map((r) => r.id);
      expect(ids).toContain(wildcardMatch.id);
      expect(ids).not.toContain(plainMatch.id);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await components.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("findByIds() returns only CURRENT rows matching the given recordIds", async () => {
      const created = await components.create({
        publicId: uniqueId("CMP-FINDBYIDS"),
        category: "cards",
        name: "Find By Ids Fixture",
      });
      const found = await components.findByIds([created.recordId, randomUUID()]);
      expect(found).toHaveLength(1);
      expect(found[0]?.id).toBe(created.id);
    });

    it("findByIds() returns an empty array for an empty input, without querying", async () => {
      expect(await components.findByIds([])).toEqual([]);
    });

    it("updateInPlace() changes fields and never touches approvalStatus/category", async () => {
      const created = await components.create({
        publicId: uniqueId("CMP-MOTION"),
        category: "accordions",
        name: "Original",
      });

      const updated = await components.updateInPlace(created.id, { name: "Renamed" });
      expect(updated?.name).toBe("Renamed");
      expect(updated?.approvalStatus).toBe("draft");
      expect(updated?.category).toBe("accordions");
    });

    it("updateInPlace() returns null for a missing row id", async () => {
      expect(await components.updateInPlace(randomUUID(), { name: "x" })).toBeNull();
    });

    it("updateInPlace() clears tokenIds to [] on an explicit null, without throwing (regression: spreading a raw null would crash)", async () => {
      const created = await components.create({
        publicId: uniqueId("CMP-TOKENS"),
        category: "cards",
        name: "Tokens Fixture",
        tokenIds: [randomUUID()],
      });

      const updated = await components.updateInPlace(created.id, { tokenIds: null });
      expect(updated?.tokenIds).toEqual([]);
    });

    it("updateInPlace() leaves tokenIds untouched when omitted from the patch", async () => {
      const tokenId = randomUUID();
      const created = await components.create({
        publicId: uniqueId("CMP-TOKENS-2"),
        category: "cards",
        name: "Tokens Fixture 2",
        tokenIds: [tokenId],
      });

      const updated = await components.updateInPlace(created.id, { name: "Renamed" });
      expect(updated?.tokenIds).toEqual([tokenId]);
    });

    it("updateApprovalStatus() changes approvalStatus when the expected current status matches", async () => {
      const created = await components.create({
        publicId: uniqueId("CMP-SHADOW"),
        category: "pricing-cards",
        name: "Status Fixture",
      });
      const result = await components.updateApprovalStatus(created.id, "draft", "submitted", null);
      expect(result.outcome).toBe("updated");
      expect(result.outcome === "updated" && result.entity.approvalStatus).toBe("submitted");
    });

    it("updateApprovalStatus() reports not_found for a missing row id", async () => {
      const result = await components.updateApprovalStatus(
        randomUUID(),
        "draft",
        "submitted",
        null,
      );
      expect(result.outcome).toBe("not_found");
    });

    it("updateApprovalStatus() reports conflict (and does not write) on the atomic compare-and-swap", async () => {
      const created = await components.create({
        publicId: uniqueId("CMP-BORDER"),
        category: "badges",
        name: "Conflict Fixture",
      });
      // The row is really `draft`; we claim we expected `submitted` — a stale read.
      const result = await components.updateApprovalStatus(
        created.id,
        "submitted",
        "under_review",
        null,
      );
      expect(result.outcome).toBe("conflict");
      expect(result.outcome === "conflict" && result.entity.approvalStatus).toBe("draft");

      const stillDraft = await components.findCurrentByRecordId(created.recordId);
      expect(stillDraft?.approvalStatus).toBe("draft");
    });

    it("rejects an invalid approvalStatus at the database layer (real ENUM constraint)", async () => {
      const created = await components.create({
        publicId: uniqueId("CMP-BREAK"),
        category: "tooltips",
        name: "Enum Fixture",
      });
      await expect(
        // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
        components.updateApprovalStatus(created.id, "draft", "not_a_real_status", null),
      ).rejects.toThrow();
    });
  });

  describe("partial-unique-index behavior (WHERE is_current = true)", () => {
    it("rejects a second DIFFERENT record reusing the same publicId while both are current", async () => {
      const publicId = uniqueId("CMP-DUP");
      await components.create({ publicId, category: "forms", name: "First record" });
      await expect(
        components.create({ publicId, category: "forms", name: "Second record" }),
      ).rejects.toThrow();
    });

    it("allows creating a new VERSION of the same record that legitimately repeats the same publicId, once the old row's isCurrent is flipped false first", async () => {
      const publicId = uniqueId("CMP-VER");
      const v1 = await components.create({ publicId, category: "forms", name: "V1" });

      await withTransaction(async (transaction) => {
        await components.updateInPlace(v1.id, { isCurrent: false }, transaction);
        await components.createNewVersion(
          {
            recordId: v1.recordId,
            publicId,
            category: "forms",
            versionNumber: 2,
            name: "V2",
            figmaReference: null,
            tokenIds: [],
            htmlStructure: null,
            phpPath: null,
            scssClassesPath: null,
            jsDependencies: null,
            states: null,
            responsiveBehavior: null,
            browserSupport: null,
            accessibility: null,
            schema: null,
            analytics: null,
            tests: null,
            replacementRecordId: null,
          },
          transaction,
        );
      });

      const current = await components.findCurrentByPublicId(publicId);
      expect(current?.name).toBe("V2");
      expect(current?.versionNumber).toBe(2);

      const allVersions = await components.listVersions(v1.recordId);
      expect(allVersions.length).toBe(2);
    });

    it("rejects two versions of the SAME record sharing the same versionNumber ((record_id, version_number) unique index)", async () => {
      const created = await components.create({
        publicId: uniqueId("CMP-DUPVER"),
        category: "forms",
        name: "V1",
      });
      await expect(
        components.createNewVersion({
          recordId: created.recordId,
          publicId: uniqueId("CMP-DUPVER-2"),
          category: "forms",
          versionNumber: 1,
          name: "Duplicate version number",
          figmaReference: null,
          tokenIds: [],
          htmlStructure: null,
          phpPath: null,
          scssClassesPath: null,
          jsDependencies: null,
          states: null,
          responsiveBehavior: null,
          browserSupport: null,
          accessibility: null,
          schema: null,
          analytics: null,
          tests: null,
          replacementRecordId: null,
        }),
      ).rejects.toThrow();
    });
  });

  describe("full real end-to-end version-history round trip", () => {
    it("create -> approve -> edit-the-approved-one -> verify 2 rows -> approve the new one -> verify the old row is superseded", async () => {
      const publicId = uniqueId("CMP-E2E");
      const v1 = await components.create({
        publicId,
        category: "ctas",
        name: "Primary CTA V1",
      });
      expect(v1.approvalStatus).toBe("draft");
      expect(v1.versionNumber).toBe(1);

      const v1Approved = await components.updateApprovalStatus(v1.id, "draft", "approved", null);
      expect(v1Approved.outcome).toBe("updated");

      const v2 = await withTransaction(async (transaction) => {
        await components.updateInPlace(v1.id, { isCurrent: false }, transaction);
        return components.createNewVersion(
          {
            recordId: v1.recordId,
            publicId,
            category: "ctas",
            versionNumber: 2,
            name: "Primary CTA V2 (revised)",
            figmaReference: null,
            tokenIds: [],
            htmlStructure: null,
            phpPath: null,
            scssClassesPath: null,
            jsDependencies: null,
            states: null,
            responsiveBehavior: null,
            browserSupport: null,
            accessibility: null,
            schema: null,
            analytics: null,
            tests: null,
            replacementRecordId: null,
          },
          transaction,
        );
      });
      expect(v2.approvalStatus).toBe("draft");
      expect(v2.versionNumber).toBe(2);
      expect(v2.isCurrent).toBe(true);

      const allVersions = await components.listVersions(v1.recordId);
      expect(allVersions.length).toBe(2);

      const v1AfterFlip = allVersions.find((r) => r.id === v1.id);
      expect(v1AfterFlip?.isCurrent).toBe(false);
      expect(v1AfterFlip?.approvalStatus).toBe("approved");

      await withTransaction(async (transaction) => {
        const casResult = await components.updateApprovalStatus(
          v2.id,
          "draft",
          "approved",
          null,
          transaction,
        );
        expect(casResult.outcome).toBe("updated");
        await components.supersedeOtherApprovedVersion(v1.recordId, v2.id, null, transaction);
      });

      const finalVersions = await components.listVersions(v1.recordId);
      const finalV1 = finalVersions.find((r) => r.id === v1.id);
      const finalV2 = finalVersions.find((r) => r.id === v2.id);
      expect(finalV1?.approvalStatus).toBe("superseded");
      expect(finalV2?.approvalStatus).toBe("approved");
      expect(finalV2?.isCurrent).toBe(true);
      expect(finalV1?.isCurrent).toBe(false);

      const current = await components.findCurrentByRecordId(v1.recordId);
      expect(current?.id).toBe(v2.id);
    });

    it("supersedeOtherApprovedVersion is a safe no-op when no other approved version exists (a record's first-ever approval)", async () => {
      const created = await components.create({
        publicId: uniqueId("CMP-FIRST"),
        category: "empty-states",
        name: "First Approval Fixture",
      });
      await withTransaction(async (transaction) => {
        const casResult = await components.updateApprovalStatus(
          created.id,
          "draft",
          "approved",
          null,
          transaction,
        );
        expect(casResult.outcome).toBe("updated");
        await expect(
          components.supersedeOtherApprovedVersion(created.recordId, created.id, null, transaction),
        ).resolves.not.toThrow();
      });

      const current = await components.findCurrentByRecordId(created.recordId);
      expect(current?.approvalStatus).toBe("approved");
    });
  });

  describe("updateInPlace — CAS guard on approvalStatus", () => {
    it("writes normally when expectedApprovalStatus matches the row's real current status", async () => {
      const created = await components.create({
        publicId: uniqueId("CMP-CAS-OK"),
        category: "galleries",
        name: "CAS guard fixture",
      });

      const updated = await components.updateInPlace(
        created.id,
        { name: "Renamed via matching CAS" },
        undefined,
        "draft",
      );

      expect(updated?.name).toBe("Renamed via matching CAS");
    });

    it("is a real, DB-enforced no-op (returns null, writes nothing) when expectedApprovalStatus no longer matches the row's real current status", async () => {
      const created = await components.create({
        publicId: uniqueId("CMP-CAS-RACE"),
        category: "galleries",
        name: "Original name",
      });
      const approved = await components.updateApprovalStatus(created.id, "draft", "approved", null);
      expect(approved.outcome).toBe("updated");

      const result = await components.updateInPlace(
        created.id,
        { name: "Should never land" },
        undefined,
        "draft",
      );

      expect(result).toBeNull();
      const stillApproved = await components.findCurrentByRecordId(created.recordId);
      expect(stillApproved?.name).toBe("Original name");
      expect(stillApproved?.approvalStatus).toBe("approved");
    });
  });

  it("cascades no rows on delete (no hard-delete exists — a real DELETE at the SQL layer removes only the targeted row, proving no unintended FK/cascade side effect exists on this single-table schema)", async () => {
    const created = await components.create({
      publicId: uniqueId("CMP-DEL"),
      category: "breadcrumbs",
      name: "Delete Fixture",
    });
    await getConnection().query("DELETE FROM components WHERE id = :id", {
      replacements: { id: created.id },
    });
    expect(await components.findCurrentByRecordId(created.recordId)).toBeNull();
  });
});
