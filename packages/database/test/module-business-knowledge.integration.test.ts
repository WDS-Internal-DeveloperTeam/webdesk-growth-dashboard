import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BusinessKnowledgeRecordRepository } from "../src/business-knowledge/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Business Knowledge Center schema (migrations `00047`-`00048`) against a REAL,
 * disposable PostgreSQL database. See `docs/task-packages/module-business-knowledge-center.md`.
 */
describe("Business Knowledge Center module (real disposable database)", () => {
  const records = new BusinessKnowledgeRecordRepository();

  beforeAll(async () => {
    const migrator = buildMigrator();
    await migrator.up();
  });

  afterAll(async () => {
    const migrator = buildMigrator();
    await migrator.down({ to: 0 });
    await closeConnection();
  });

  it("creates a record defaulting to draft status", async () => {
    const record = await records.create({
      recordType: "vto",
      title: "Vision/Traction/Organizer",
      content: "Draft VTO content.",
    });
    expect(record.status).toBe("draft");
    expect(record.recordType).toBe("vto");
    expect(record.notes).toBeNull();
  });

  it("finds a record by id, and returns null for a missing one", async () => {
    const created = await records.create({
      recordType: "competitor",
      title: "Acme Competitor",
      content: "Notes about a competitor.",
    });
    const found = await records.findById(created.id);
    expect(found?.id).toBe(created.id);

    const missing = await records.findById("00000000-0000-4000-8000-000000000000");
    expect(missing).toBeNull();
  });

  it("filters list() by recordType and by status", async () => {
    await records.create({
      recordType: "persona_icp",
      title: "Persona A",
      content: "Persona A content.",
    });
    const byType = await records.list({ recordType: "persona_icp" });
    expect(byType.length).toBeGreaterThan(0);
    expect(byType.every((r) => r.recordType === "persona_icp")).toBe(true);

    const byStatus = await records.list({ status: "draft" });
    expect(byStatus.length).toBeGreaterThan(0);
    expect(byStatus.every((r) => r.status === "draft")).toBe(true);
  });

  it("update() changes title/content/notes but never status", async () => {
    const created = await records.create({
      recordType: "strategic_priority",
      title: "Original title",
      content: "Original content.",
    });
    const updated = await records.update(created.id, {
      title: "Updated title",
      notes: "Some notes",
    });
    expect(updated?.title).toBe("Updated title");
    expect(updated?.notes).toBe("Some notes");
    expect(updated?.status).toBe("draft"); // unchanged — update() has no status parameter at all
  });

  it("update() returns null for a missing record", async () => {
    const result = await records.update("00000000-0000-4000-8000-000000000000", {
      title: "x",
    });
    expect(result).toBeNull();
  });

  it("updateStatus() changes status and returns null for a missing record", async () => {
    const created = await records.create({
      recordType: "geographic_scope",
      title: "North America",
      content: "Geographic scope content.",
    });
    const updated = await records.updateStatus(created.id, "mandatory", null);
    expect(updated?.status).toBe("mandatory");

    const missing = await records.updateStatus(
      "00000000-0000-4000-8000-000000000000",
      "mandatory",
      null,
    );
    expect(missing).toBeNull();
  });

  it("rejects an invalid record_type or status at the database layer (real ENUM constraint)", async () => {
    await expect(
      records.create({
        // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint, not just Zod
        recordType: "not_a_real_type",
        title: "x",
        content: "y",
      }),
    ).rejects.toThrow();
  });
});
