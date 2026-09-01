import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KnowledgeLibraryRecordRepository } from "../src/knowledge-library/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Knowledge Library schema (migration `00095`) against a REAL, disposable
 * PostgreSQL database. Mirrors ../test/module-persona-library.integration.test.ts's own
 * structure — the closest sibling (a single organization-wide table, a server-managed `version`
 * counter incremented atomically on `update()`, an atomic compare-and-swap `updateStatus()`).
 */
describe("Knowledge Library module (real disposable database)", () => {
  const records = new KnowledgeLibraryRecordRepository();

  let counter = 0;
  function uniqueTitle(prefix: string): string {
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

  describe("KnowledgeLibraryRecordRepository", () => {
    it("creates a record defaulting to draft status, public confidentiality, version 1, false approvedForAgentUse, and an empty relatedEntityIds array", async () => {
      const created = await records.create({ title: uniqueTitle("Record") });
      expect(created.status).toBe("draft");
      expect(created.confidentiality).toBe("public");
      expect(created.version).toBe(1);
      expect(created.approvedForAgentUse).toBe(false);
      expect(created.relatedEntityIds).toEqual([]);
      expect(created.ownerUserId).toBeNull();
    });

    it("round-trips sourceType/location/sourceDate/notes/relatedEntityIds and a real confidentiality value", async () => {
      const created = await records.create({
        title: uniqueTitle("Full record"),
        sourceType: "internal_wiki",
        location: "https://wiki.internal.example/page",
        sourceDate: "2026-01-15",
        confidentiality: "internal",
        approvedForAgentUse: true,
        notes: "Some notes",
        relatedEntityIds: ["entity-1", "entity-2"],
      });
      const found = await records.findById(created.id);
      expect(found?.sourceType).toBe("internal_wiki");
      expect(found?.location).toBe("https://wiki.internal.example/page");
      expect(found?.sourceDate).toBe("2026-01-15");
      expect(found?.confidentiality).toBe("internal");
      expect(found?.approvedForAgentUse).toBe(true);
      expect(found?.notes).toBe("Some notes");
      expect(found?.relatedEntityIds).toEqual(["entity-1", "entity-2"]);
    });

    it("findById returns null for a missing record", async () => {
      expect(await records.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("list() filters by status, confidentiality, sourceType (exact match), and approvedForAgentUse", async () => {
      await records.create({
        title: uniqueTitle("Filter fixture"),
        sourceType: "unique_source_type_marker",
        confidentiality: "restricted",
        approvedForAgentUse: true,
      });

      const byStatus = await records.list({ status: "draft" });
      expect(byStatus.length).toBeGreaterThanOrEqual(1);

      const byConfidentiality = await records.list({ confidentiality: "restricted" });
      expect(byConfidentiality.length).toBeGreaterThanOrEqual(1);
      expect(byConfidentiality.every((r) => r.confidentiality === "restricted")).toBe(true);

      const bySourceType = await records.list({ sourceType: "unique_source_type_marker" });
      expect(bySourceType.length).toBe(1);

      const byApprovedForAgentUse = await records.list({ approvedForAgentUse: true });
      expect(byApprovedForAgentUse.length).toBeGreaterThanOrEqual(1);
      expect(byApprovedForAgentUse.every((r) => r.approvedForAgentUse === true)).toBe(true);
    });

    it("list() finds a record via a fuzzy substring match on title through the search filter (backed by the trigram index)", async () => {
      const title = uniqueTitle("Onboarding Reference Guide");
      const created = await records.create({ title });

      const found = await records.list({ search: "onboarding reference" });
      expect(found.some((r) => r.id === created.id)).toBe(true);

      const notFound = await records.list({ search: "definitely-not-a-real-title-substring" });
      expect(notFound.some((r) => r.id === created.id)).toBe(false);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await records.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("update() changes content fields, increments version by exactly 1, and never touches status", async () => {
      const created = await records.create({ title: "Original" });
      expect(created.version).toBe(1);

      const updated = await records.update(created.id, { title: "Renamed" });
      expect(updated?.title).toBe("Renamed");
      expect(updated?.status).toBe("draft");
      expect(updated?.version).toBe(2);

      const updatedAgain = await records.update(created.id, { title: "Renamed Again" });
      expect(updatedAgain?.version).toBe(3);
    });

    it("update() with concurrent-style repeated calls still increments version atomically (no lost updates)", async () => {
      const created = await records.create({ title: "Concurrency Fixture" });

      // Fire several updates "concurrently" (no await between issuing them) — a naive
      // read-then-write `version: current + 1` would lose increments under this exact shape; the
      // real atomic `UPDATE ... SET version = version + 1` must not.
      await Promise.all([
        records.update(created.id, { sourceType: "a" }),
        records.update(created.id, { sourceType: "b" }),
        records.update(created.id, { sourceType: "c" }),
      ]);

      const final = await records.findById(created.id);
      expect(final?.version).toBe(4); // 1 (create) + 3 concurrent updates
    });

    it("update() returns null for a missing record", async () => {
      expect(
        await records.update("00000000-0000-4000-8000-000000000000", { title: "x" }),
      ).toBeNull();
    });

    it("update() normalizes an explicit null on relatedEntityIds to an empty array, and leaves it untouched when omitted", async () => {
      const created = await records.create({
        title: "Array Clearing Fixture",
        relatedEntityIds: ["entity-1"],
      });

      const updated = await records.update(created.id, { relatedEntityIds: null });
      expect(updated?.relatedEntityIds).toEqual([]);

      const untouched = await records.update(created.id, { title: "still here" });
      expect(untouched?.relatedEntityIds).toEqual([]);
    });

    it("update() can set lastReviewedAt", async () => {
      const created = await records.create({ title: "Review fixture" });
      const updated = await records.update(created.id, {
        lastReviewedAt: "2026-02-01T00:00:00.000Z",
      });
      expect(updated?.lastReviewedAt).toBe("2026-02-01T00:00:00.000Z");
    });

    it("updateStatus() changes status when the expected current status matches, and does not touch version", async () => {
      const created = await records.create({ title: "Status Fixture" });
      const result = await records.updateStatus(created.id, "draft", "mandatory", null);
      expect(result.outcome).toBe("updated");
      expect(result.outcome === "updated" && result.entity.status).toBe("mandatory");
      expect(result.outcome === "updated" && result.entity.version).toBe(1);
    });

    it("updateStatus() reports not_found for a missing record", async () => {
      const result = await records.updateStatus(
        "00000000-0000-4000-8000-000000000000",
        "draft",
        "mandatory",
        null,
      );
      expect(result.outcome).toBe("not_found");
    });

    it("updateStatus() reports conflict (and does not write) on the atomic compare-and-swap", async () => {
      const created = await records.create({ title: "Conflict Fixture" });
      // The record is really `draft`; claim we expected `mandatory` — a stale read.
      const result = await records.updateStatus(created.id, "mandatory", "advisory", null);
      expect(result.outcome).toBe("conflict");
      expect(result.outcome === "conflict" && result.entity.status).toBe("draft");

      const stillDraft = await records.findById(created.id);
      expect(stillDraft?.status).toBe("draft");
    });

    it("rejects an invalid status at the database layer (real ENUM constraint)", async () => {
      const created = await records.create({ title: "Enum Fixture" });
      await expect(
        // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
        records.updateStatus(created.id, "draft", "not_a_real_status", null),
      ).rejects.toThrow();
    });

    it("rejects an invalid confidentiality value at the database layer (real ENUM constraint)", async () => {
      await expect(
        // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
        records.create({ title: "Bad confidentiality", confidentiality: "not_a_real_value" }),
      ).rejects.toThrow();
    });
  });
});
