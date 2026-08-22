import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PersonaRepository } from "../src/persona-library/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Persona Library schema (migration `00052`) against a REAL, disposable PostgreSQL
 * database. Mirrors ../test/module-service-library.integration.test.ts's own structure, minus the
 * dimension/relationship-join-table coverage this module doesn't have.
 */
describe("Persona Library module (real disposable database)", () => {
  const personas = new PersonaRepository();

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

  describe("PersonaRepository", () => {
    it("creates a persona defaulting to draft approvalStatus, version 1, and empty arrays", async () => {
      const persona = await personas.create({
        publicId: uniqueId("PERSONA"),
        name: "Enterprise IT Director",
      });
      expect(persona.approvalStatus).toBe("draft");
      expect(persona.version).toBe(1);
      expect(persona.roles).toEqual([]);
      expect(persona.industries).toEqual([]);
      expect(persona.relatedServiceIds).toEqual([]);
    });

    it("round-trips roles/industries/relatedServiceIds array columns", async () => {
      const persona = await personas.create({
        publicId: uniqueId("PERSONA"),
        name: "Persona with relationships",
        roles: ["VP Engineering", "CTO"],
        industries: ["SaaS", "Ecommerce"],
        relatedServiceIds: ["SVC-1", "SVC-2"],
      });
      const found = await personas.findById(persona.id);
      expect(found?.roles).toEqual(["VP Engineering", "CTO"]);
      expect(found?.industries).toEqual(["SaaS", "Ecommerce"]);
      expect(found?.relatedServiceIds).toEqual(["SVC-1", "SVC-2"]);
    });

    it("rejects a duplicate publicId at the database layer", async () => {
      const publicId = uniqueId("PERSONA");
      await personas.create({ publicId, name: "First" });
      await expect(personas.create({ publicId, name: "Second" })).rejects.toThrow();
    });

    it("finds by publicId, and returns null for a missing one", async () => {
      const publicId = uniqueId("PERSONA");
      const created = await personas.create({ publicId, name: "X" });
      expect((await personas.findByPublicId(publicId))?.id).toBe(created.id);
      expect(await personas.findByPublicId("PERSONA-does-not-exist")).toBeNull();
    });

    it("findById returns null for a missing persona", async () => {
      expect(await personas.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("list() filters by approvalStatus and search (case-insensitive)", async () => {
      const uniqueName = uniqueId("Unique Searchable Persona");
      await personas.create({ publicId: uniqueId("PERSONA"), name: uniqueName });

      const byStatus = await personas.list({ approvalStatus: "draft" });
      expect(byStatus.length).toBeGreaterThanOrEqual(1);

      const bySearch = await personas.list({ search: uniqueName.toLowerCase() });
      expect(bySearch.length).toBe(1);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await personas.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("update() changes content fields, increments version by exactly 1, and never touches approvalStatus", async () => {
      const created = await personas.create({
        publicId: uniqueId("PERSONA"),
        name: "Original",
      });
      expect(created.version).toBe(1);

      const updated = await personas.update(created.id, { name: "Renamed" });
      expect(updated?.name).toBe("Renamed");
      expect(updated?.approvalStatus).toBe("draft");
      expect(updated?.version).toBe(2);

      const updatedAgain = await personas.update(created.id, { name: "Renamed Again" });
      expect(updatedAgain?.version).toBe(3);
    });

    it("update() with concurrent-style repeated calls still increments version atomically (no lost updates)", async () => {
      const created = await personas.create({
        publicId: uniqueId("PERSONA"),
        name: "Concurrency Fixture",
      });

      // Fire several updates "concurrently" (no await between issuing them) — a naive
      // read-then-write `version: current + 1` would lose increments under this exact shape; the
      // real atomic `UPDATE ... SET version = version + 1` must not.
      await Promise.all([
        personas.update(created.id, { buyerType: "A" }),
        personas.update(created.id, { buyerType: "B" }),
        personas.update(created.id, { buyerType: "C" }),
      ]);

      const final = await personas.findById(created.id);
      expect(final?.version).toBe(4); // 1 (create) + 3 concurrent updates
    });

    it("update() returns null for a missing persona", async () => {
      expect(
        await personas.update("00000000-0000-4000-8000-000000000000", { name: "x" }),
      ).toBeNull();
    });

    it("update() normalizes an explicit null on an array field to an empty array, and leaves an omitted array field untouched", async () => {
      const created = await personas.create({
        publicId: uniqueId("PERSONA"),
        name: "Array Clearing Fixture",
        roles: ["CTO"],
        industries: ["SaaS"],
        relatedServiceIds: ["SVC-1"],
      });

      // roles: null means "clear it"; industries omitted entirely means "leave it as-is" — the
      // NOT NULL array column can never actually store null, so this proves the repository's own
      // null-to-empty-array normalization, not a raw pass-through to Postgres (code-review
      // finding: this previously only accepted `[]` to clear, rejecting `null` with a 400 at the
      // DTO layer before it ever reached here — this test exercises the repository's own half of
      // that fix directly).
      const updated = await personas.update(created.id, { roles: null });
      expect(updated?.roles).toEqual([]);
      expect(updated?.industries).toEqual(["SaaS"]);
      expect(updated?.relatedServiceIds).toEqual(["SVC-1"]);
    });

    it("updateStatus() changes approvalStatus when the expected current status matches, and does not touch version", async () => {
      const created = await personas.create({
        publicId: uniqueId("PERSONA"),
        name: "Status Fixture",
      });
      const result = await personas.updateStatus(created.id, "draft", "submitted", null);
      expect(result.outcome).toBe("updated");
      expect(result.outcome === "updated" && result.entity.approvalStatus).toBe("submitted");
      expect(result.outcome === "updated" && result.entity.version).toBe(1);
    });

    it("updateStatus() reports not_found for a missing persona", async () => {
      const result = await personas.updateStatus(
        "00000000-0000-4000-8000-000000000000",
        "draft",
        "submitted",
        null,
      );
      expect(result.outcome).toBe("not_found");
    });

    it("updateStatus() reports conflict (and does not write) on the atomic compare-and-swap", async () => {
      const created = await personas.create({
        publicId: uniqueId("PERSONA"),
        name: "Conflict Fixture",
      });
      // The persona is really `draft`; claim we expected `submitted` — a stale read.
      const result = await personas.updateStatus(created.id, "submitted", "under_review", null);
      expect(result.outcome).toBe("conflict");
      expect(result.outcome === "conflict" && result.entity.approvalStatus).toBe("draft");

      const stillDraft = await personas.findById(created.id);
      expect(stillDraft?.approvalStatus).toBe("draft");
    });

    it("rejects an invalid approvalStatus at the database layer (real ENUM constraint)", async () => {
      // create() itself never accepts approvalStatus at all (D4) — the only write path that ever
      // sets it is updateStatus(), so that's what exercises the DB-level ENUM constraint here.
      const created = await personas.create({ publicId: uniqueId("PERSONA"), name: "y" });
      await expect(
        // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
        personas.updateStatus(created.id, "draft", "not_a_real_status", null),
      ).rejects.toThrow();
    });
  });
});
