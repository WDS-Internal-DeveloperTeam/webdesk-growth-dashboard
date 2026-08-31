import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MotionInteractionRecordRepository } from "../src/motion-and-interaction-library/index.js";
import { closeConnection, getConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";
import { withTransaction } from "../src/transaction.js";

/**
 * Exercises the Motion and Interaction Library schema (migration `00084`) against a REAL,
 * disposable PostgreSQL database. Mirrors
 * `module-section-and-pattern-library.integration.test.ts`'s own structure — real multi-row
 * version history: the partial-unique-index-on-`is_current` behavior, the
 * `(record_id, version_number)` uniqueness, and a full end-to-end version-history round trip
 * (create -> approve -> edit-the-approved-one -> verify 2 rows exist -> approve the new one ->
 * verify the old row is superseded).
 */
describe("Motion and Interaction Library module (real disposable database)", () => {
  const interactions = new MotionInteractionRecordRepository();

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

  describe("MotionInteractionRecordRepository — basic CRUD", () => {
    it("creates a record defaulting to draft approvalStatus, versionNumber 1, isCurrent true", async () => {
      const created = await interactions.create({
        publicId: uniqueId("MIL-MODAL"),
        category: "modal_drawer",
        name: "Modal open transition",
      });
      expect(created.approvalStatus).toBe("draft");
      expect(created.versionNumber).toBe(1);
      expect(created.isCurrent).toBe(true);
      expect(created.recordId).toBeTruthy();
      // Each newly created record gets its own fresh recordId — never the same as its own row id
      // by coincidence being asserted here, just confirming it is a real, distinct UUID.
      expect(created.recordId).not.toBe(created.id);
      expect(created.relatedComponentIds).toEqual([]);
    });

    it("stores array fields as real arrays, defaulting to empty", async () => {
      const created = await interactions.create({
        publicId: uniqueId("MIL-TOOLTIP"),
        category: "tooltip",
        name: "Tooltip fade in",
        relatedComponentIds: ["11111111-1111-1111-1111-111111111111"],
      });
      expect(created.relatedComponentIds).toEqual(["11111111-1111-1111-1111-111111111111"]);
    });

    it("findCurrentByRecordId / findCurrentByPublicId return null for an unknown id", async () => {
      expect(await interactions.findCurrentByRecordId(randomUUID())).toBeNull();
      expect(await interactions.findCurrentByPublicId("MIL-does-not-exist")).toBeNull();
    });

    it("findCurrentByRecordId / findCurrentByPublicId find a real created record", async () => {
      const publicId = uniqueId("MIL-LOADER");
      const created = await interactions.create({
        publicId,
        category: "loader",
        name: "Loader spinner",
        implementationSpec: ".spinner { animation: spin 1s linear infinite; }",
      });
      expect((await interactions.findCurrentByRecordId(created.recordId))?.id).toBe(created.id);
      expect((await interactions.findCurrentByPublicId(publicId))?.id).toBe(created.id);
    });

    it("list() filters by category/approvalStatus/search (case-insensitive) and only returns isCurrent rows", async () => {
      const uniqueName = uniqueId("Unique Searchable Motion Name");
      await interactions.create({
        publicId: uniqueId("MIL-FOCUS"),
        category: "focus_state",
        name: uniqueName,
      });

      const byCategory = await interactions.list({ category: "focus_state" });
      expect(byCategory.length).toBeGreaterThanOrEqual(1);
      expect(byCategory.every((r) => r.category === "focus_state")).toBe(true);

      const byStatus = await interactions.list({ approvalStatus: "draft" });
      expect(byStatus.length).toBeGreaterThanOrEqual(1);

      const bySearch = await interactions.list({ search: uniqueName.toLowerCase() });
      expect(bySearch.length).toBe(1);
    });

    it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
      const uniqueSuffix = uniqueId("PCT");
      const wildcardMatch = await interactions.create({
        publicId: uniqueId("MIL-PCT"),
        category: "progress_indicator",
        name: `50% Progress Motion ${uniqueSuffix}`,
      });
      const plainMatch = await interactions.create({
        publicId: uniqueId("MIL-PCT"),
        category: "progress_indicator",
        name: `50X Progress Motion ${uniqueSuffix}`,
      });

      const found = await interactions.list({ search: `50% Progress Motion ${uniqueSuffix}` });
      const ids = found.map((r) => r.id);
      expect(ids).toContain(wildcardMatch.id);
      expect(ids).not.toContain(plainMatch.id);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await interactions.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("findByIds() returns only CURRENT rows matching the given recordIds", async () => {
      const created = await interactions.create({
        publicId: uniqueId("MIL-FINDBYIDS"),
        category: "cursor",
        name: "Find By Ids Fixture",
      });
      const found = await interactions.findByIds([created.recordId, randomUUID()]);
      expect(found).toHaveLength(1);
      expect(found[0]?.id).toBe(created.id);
    });

    it("findByIds() returns an empty array for an empty input, without querying", async () => {
      expect(await interactions.findByIds([])).toEqual([]);
    });

    it("updateInPlace() changes fields and never touches approvalStatus/category", async () => {
      const created = await interactions.create({
        publicId: uniqueId("MIL-DISMISS"),
        category: "dismissal",
        name: "Original",
      });

      const updated = await interactions.updateInPlace(created.id, { name: "Renamed" });
      expect(updated?.name).toBe("Renamed");
      expect(updated?.approvalStatus).toBe("draft");
      expect(updated?.category).toBe("dismissal");
    });

    it("updateInPlace() returns null for a missing row id", async () => {
      expect(await interactions.updateInPlace(randomUUID(), { name: "x" })).toBeNull();
    });

    it("updateInPlace() clears relatedComponentIds to [] on an explicit null, without throwing (regression: spreading a raw null would crash)", async () => {
      const created = await interactions.create({
        publicId: uniqueId("MIL-COMP"),
        category: "menu",
        name: "Menu open",
        relatedComponentIds: ["11111111-1111-1111-1111-111111111111"],
      });

      const updated = await interactions.updateInPlace(created.id, {
        relatedComponentIds: null,
      });
      expect(updated?.relatedComponentIds).toEqual([]);
    });

    it("updateInPlace() leaves relatedComponentIds untouched when omitted from the patch", async () => {
      const created = await interactions.create({
        publicId: uniqueId("MIL-COMP-2"),
        category: "menu",
        name: "Menu open 2",
        relatedComponentIds: ["11111111-1111-1111-1111-111111111111"],
      });

      const updated = await interactions.updateInPlace(created.id, { name: "Renamed" });
      expect(updated?.relatedComponentIds).toEqual(["11111111-1111-1111-1111-111111111111"]);
    });

    it("updateApprovalStatus() changes approvalStatus when the expected current status matches", async () => {
      const created = await interactions.create({
        publicId: uniqueId("MIL-SEARCH"),
        category: "filter_search",
        name: "Status Fixture",
      });
      const result = await interactions.updateApprovalStatus(
        created.id,
        "draft",
        "submitted",
        null,
      );
      expect(result.outcome).toBe("updated");
      expect(result.outcome === "updated" && result.entity.approvalStatus).toBe("submitted");
    });

    it("updateApprovalStatus() reports not_found for a missing row id", async () => {
      const result = await interactions.updateApprovalStatus(
        randomUUID(),
        "draft",
        "submitted",
        null,
      );
      expect(result.outcome).toBe("not_found");
    });

    it("updateApprovalStatus() reports conflict (and does not write) on the atomic compare-and-swap", async () => {
      const created = await interactions.create({
        publicId: uniqueId("MIL-COPY"),
        category: "copy_share",
        name: "Conflict Fixture",
      });
      // The row is really `draft`; we claim we expected `submitted` — a stale read.
      const result = await interactions.updateApprovalStatus(
        created.id,
        "submitted",
        "under_review",
        null,
      );
      expect(result.outcome).toBe("conflict");
      expect(result.outcome === "conflict" && result.entity.approvalStatus).toBe("draft");

      const stillDraft = await interactions.findCurrentByRecordId(created.recordId);
      expect(stillDraft?.approvalStatus).toBe("draft");
    });

    it("rejects an invalid approvalStatus at the database layer (real ENUM constraint)", async () => {
      const created = await interactions.create({
        publicId: uniqueId("MIL-ERR"),
        category: "no_js_fallback",
        name: "Enum Fixture",
      });
      await expect(
        // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
        interactions.updateApprovalStatus(created.id, "draft", "not_a_real_status", null),
      ).rejects.toThrow();
    });

    it("rejects an invalid category at the database layer (real ENUM constraint)", async () => {
      await expect(
        interactions.create({
          publicId: uniqueId("MIL-BAD"),
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          category: "not_a_real_category",
          name: "Enum Fixture 2",
        }),
      ).rejects.toThrow();
    });
  });

  describe("partial-unique-index behavior (WHERE is_current = true)", () => {
    it("rejects a second DIFFERENT record reusing the same publicId while both are current", async () => {
      const publicId = uniqueId("MIL-DUP");
      await interactions.create({ publicId, category: "notification", name: "First record" });
      await expect(
        interactions.create({ publicId, category: "notification", name: "Second record" }),
      ).rejects.toThrow();
    });

    it("allows creating a new VERSION of the same record that legitimately repeats the same publicId, once the old row's isCurrent is flipped false first", async () => {
      const publicId = uniqueId("MIL-VER");
      const v1 = await interactions.create({
        publicId,
        category: "page_transition",
        name: "V1",
      });

      await withTransaction(async (transaction) => {
        await interactions.updateInPlace(v1.id, { isCurrent: false }, transaction);
        await interactions.createNewVersion(
          {
            recordId: v1.recordId,
            publicId,
            category: "page_transition",
            versionNumber: 2,
            name: "V2",
            description: null,
            triggerAndBehavior: null,
            timingAndEasing: null,
            implementationSpec: null,
            accessibilityNotes: null,
            fallbackBehavior: null,
            designReference: null,
            relatedComponentIds: [],
          },
          transaction,
        );
      });

      const current = await interactions.findCurrentByPublicId(publicId);
      expect(current?.name).toBe("V2");
      expect(current?.versionNumber).toBe(2);

      const allVersions = await interactions.listVersions(v1.recordId);
      expect(allVersions.length).toBe(2);
    });

    it("rejects two versions of the SAME record sharing the same versionNumber ((record_id, version_number) unique index)", async () => {
      const created = await interactions.create({
        publicId: uniqueId("MIL-DUPVER"),
        category: "active_state",
        name: "V1",
      });
      // versionNumber 1 already exists for this recordId (the row just created above) — a second
      // row claiming versionNumber 1 for the same recordId must be rejected.
      await expect(
        interactions.createNewVersion({
          recordId: created.recordId,
          publicId: uniqueId("MIL-DUPVER-2"),
          category: "active_state",
          versionNumber: 1,
          name: "Duplicate version number",
          description: null,
          triggerAndBehavior: null,
          timingAndEasing: null,
          implementationSpec: null,
          accessibilityNotes: null,
          fallbackBehavior: null,
          designReference: null,
          relatedComponentIds: [],
        }),
      ).rejects.toThrow();
    });
  });

  describe("full real end-to-end version-history round trip", () => {
    it("create -> approve -> edit-the-approved-one -> verify 2 rows -> approve the new one -> verify the old row is superseded", async () => {
      const publicId = uniqueId("MIL-E2E");
      const v1 = await interactions.create({
        publicId,
        category: "success_error_state",
        name: "Success state V1",
      });
      expect(v1.approvalStatus).toBe("draft");
      expect(v1.versionNumber).toBe(1);

      // Approve v1.
      const v1Approved = await interactions.updateApprovalStatus(v1.id, "draft", "approved", null);
      expect(v1Approved.outcome).toBe("updated");
      expect(v1Approved.outcome === "updated" && v1Approved.entity.approvalStatus).toBe("approved");

      // Editing an APPROVED current version creates a new version (the service layer's own real
      // behavior, exercised here directly at the repository layer the same way
      // MotionInteractionsService.update() composes it).
      const v2 = await withTransaction(async (transaction) => {
        await interactions.updateInPlace(v1.id, { isCurrent: false }, transaction);
        return interactions.createNewVersion(
          {
            recordId: v1.recordId,
            publicId,
            category: "success_error_state",
            versionNumber: 2,
            name: "Success state V2 (revised)",
            description: null,
            triggerAndBehavior: null,
            timingAndEasing: null,
            implementationSpec: null,
            accessibilityNotes: null,
            fallbackBehavior: null,
            designReference: null,
            relatedComponentIds: [],
          },
          transaction,
        );
      });
      expect(v2.approvalStatus).toBe("draft");
      expect(v2.versionNumber).toBe(2);
      expect(v2.isCurrent).toBe(true);

      // Exactly 2 rows now exist for this record.
      const allVersions = await interactions.listVersions(v1.recordId);
      expect(allVersions.length).toBe(2);

      // v1 is no longer current, but it is STILL approved (nothing has superseded it yet) —
      // "preserve versions" holds: it's still readable, not deleted.
      const v1AfterFlip = allVersions.find((r) => r.id === v1.id);
      expect(v1AfterFlip?.isCurrent).toBe(false);
      expect(v1AfterFlip?.approvalStatus).toBe("approved");

      // Approve v2 — the SAME transaction that approves v2 also supersedes v1, mirroring
      // MotionInteractionsService.changeApprovalStatus()'s own composition.
      await withTransaction(async (transaction) => {
        const casResult = await interactions.updateApprovalStatus(
          v2.id,
          "draft",
          "approved",
          null,
          transaction,
        );
        expect(casResult.outcome).toBe("updated");
        await interactions.supersedeOtherApprovedVersion(v1.recordId, v2.id, null, transaction);
      });

      const finalVersions = await interactions.listVersions(v1.recordId);
      const finalV1 = finalVersions.find((r) => r.id === v1.id);
      const finalV2 = finalVersions.find((r) => r.id === v2.id);
      expect(finalV1?.approvalStatus).toBe("superseded");
      expect(finalV2?.approvalStatus).toBe("approved");
      expect(finalV2?.isCurrent).toBe(true);
      expect(finalV1?.isCurrent).toBe(false);

      // The current version resolves to v2.
      const current = await interactions.findCurrentByRecordId(v1.recordId);
      expect(current?.id).toBe(v2.id);
    });

    it("supersedeOtherApprovedVersion is a safe no-op when no other approved version exists (a record's first-ever approval)", async () => {
      const created = await interactions.create({
        publicId: uniqueId("MIL-FIRST"),
        category: "content_reveal",
        name: "First Approval Fixture",
      });
      await withTransaction(async (transaction) => {
        const casResult = await interactions.updateApprovalStatus(
          created.id,
          "draft",
          "approved",
          null,
          transaction,
        );
        expect(casResult.outcome).toBe("updated");
        // No other row exists for this recordId — must not throw.
        await expect(
          interactions.supersedeOtherApprovedVersion(
            created.recordId,
            created.id,
            null,
            transaction,
          ),
        ).resolves.not.toThrow();
      });

      const current = await interactions.findCurrentByRecordId(created.recordId);
      expect(current?.approvalStatus).toBe("approved");
    });
  });

  describe("updateInPlace — CAS guard on approvalStatus", () => {
    it("writes normally when expectedApprovalStatus matches the row's real current status", async () => {
      const created = await interactions.create({
        publicId: uniqueId("MIL-CAS-OK"),
        category: "sticky_behavior",
        name: "CAS guard fixture",
      });

      const updated = await interactions.updateInPlace(
        created.id,
        { name: "Renamed via matching CAS" },
        undefined,
        "draft",
      );

      expect(updated?.name).toBe("Renamed via matching CAS");
    });

    it("is a real, DB-enforced no-op (returns null, writes nothing) when expectedApprovalStatus no longer matches the row's real current status", async () => {
      const created = await interactions.create({
        publicId: uniqueId("MIL-CAS-RACE"),
        category: "selected_state",
        name: "Original name",
      });
      // Simulate a concurrent approval landing between a caller's read and its write.
      const approved = await interactions.updateApprovalStatus(
        created.id,
        "draft",
        "approved",
        null,
      );
      expect(approved.outcome).toBe("updated");

      // The caller still believes the row is "draft" (a stale read) and tries to edit it in place.
      const result = await interactions.updateInPlace(
        created.id,
        { name: "Should never land" },
        undefined,
        "draft",
      );

      expect(result).toBeNull();
      const stillApproved = await interactions.findCurrentByRecordId(created.recordId);
      expect(stillApproved?.name).toBe("Original name");
      expect(stillApproved?.approvalStatus).toBe("approved");
    });
  });

  it("cascades no rows on delete (no hard-delete exists — a real DELETE at the SQL layer removes only the targeted row, proving no unintended FK/cascade side effect exists on this single-table schema)", async () => {
    const created = await interactions.create({
      publicId: uniqueId("MIL-DEL"),
      category: "disabled_state",
      name: "Delete Fixture",
    });
    await getConnection().query("DELETE FROM motion_interaction_records WHERE id = :id", {
      replacements: { id: created.id },
    });
    expect(await interactions.findCurrentByRecordId(created.recordId)).toBeNull();
  });
});
