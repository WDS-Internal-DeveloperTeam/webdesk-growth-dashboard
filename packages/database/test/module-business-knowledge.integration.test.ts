import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  BusinessKnowledgeAttachmentRepository,
  BusinessKnowledgeRecordRepository,
} from "../src/business-knowledge/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Business Knowledge Center schema (migrations `00047`-`00049`) against a REAL,
 * disposable PostgreSQL database. See `docs/task-packages/module-business-knowledge-center.md`
 * and `docs/task-packages/business-knowledge-center-rich-content-attachments.md`.
 */
describe("Business Knowledge Center module (real disposable database)", () => {
  const records = new BusinessKnowledgeRecordRepository();
  const attachments = new BusinessKnowledgeAttachmentRepository();

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

  it("updateStatus() changes status when the expected current status matches", async () => {
    const created = await records.create({
      recordType: "geographic_scope",
      title: "North America",
      content: "Geographic scope content.",
    });
    const result = await records.updateStatus(created.id, "draft", "mandatory", null);
    expect(result.outcome).toBe("updated");
    expect(result.outcome === "updated" && result.entity.status).toBe("mandatory");
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

  it("updateStatus() reports conflict (and does not write) when the expected current status no longer matches — the atomic compare-and-swap", async () => {
    const created = await records.create({
      recordType: "engagement_model",
      title: "Model",
      content: "Content.",
    });
    // The record is really `draft`; claim we expected `mandatory` — a stale read.
    const result = await records.updateStatus(created.id, "mandatory", "advisory", null);
    expect(result.outcome).toBe("conflict");
    expect(result.outcome === "conflict" && result.entity.status).toBe("draft");

    // Prove the conflicting write never actually applied.
    const stillDraft = await records.findById(created.id);
    expect(stillDraft?.status).toBe("draft");
  });

  it("list() clamps an oversized limit to MAX_LIST_LIMIT (200) rather than returning unbounded rows", async () => {
    const result = await records.list({ limit: 100_000 });
    expect(result.length).toBeLessThanOrEqual(200);
  });

  it("list() honors a real limit/offset pair for pagination", async () => {
    for (let i = 0; i < 3; i += 1) {
      await records.create({
        recordType: "service_taxonomy",
        title: `Pagination fixture ${i}`,
        content: "x",
      });
    }
    const firstPage = await records.list({ recordType: "service_taxonomy", limit: 2, offset: 0 });
    const secondPage = await records.list({ recordType: "service_taxonomy", limit: 2, offset: 2 });
    expect(firstPage.length).toBe(2);
    expect(secondPage.length).toBeGreaterThanOrEqual(1);
    expect(firstPage.map((r) => r.id)).not.toEqual(
      expect.arrayContaining(secondPage.map((r) => r.id)),
    );
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

  it("creates a record with content: null — an attachment-only record, migration 00049's relaxed NOT NULL constraint", async () => {
    const record = await records.create({
      recordType: "vto",
      title: "Attachment-only record",
      content: null,
    });
    expect(record.content).toBeNull();
  });

  describe("BusinessKnowledgeAttachmentRepository", () => {
    async function createRecord(): Promise<string> {
      const record = await records.create({
        recordType: "competitor",
        title: "Attachment host record",
        content: "Some content.",
      });
      return record.id;
    }

    it("creates an attachment and lists it back for its record", async () => {
      const recordId = await createRecord();
      const created = await attachments.create({
        recordId,
        filename: "report.pdf",
        mimeType: "application/pdf",
        sizeBytes: 12_345,
        checksumSha256: "a".repeat(64),
        blobPathname: "business-knowledge/report-abc123.pdf",
        extractedPreviewHtml: null,
        scanStatus: "scan_not_configured",
        uploadedBy: null,
      });
      expect(created.recordId).toBe(recordId);
      expect(created.scanStatus).toBe("scan_not_configured");

      const list = await attachments.listForRecord(recordId);
      expect(list.map((a) => a.id)).toContain(created.id);
    });

    it("findByIdForRecord returns null when the attachment belongs to a different record (IDOR guard)", async () => {
      const recordAId = await createRecord();
      const recordBId = await createRecord();
      const attachment = await attachments.create({
        recordId: recordAId,
        filename: "notes.md",
        mimeType: "text/markdown",
        sizeBytes: 100,
        checksumSha256: "b".repeat(64),
        blobPathname: "business-knowledge/notes-xyz.md",
        extractedPreviewHtml: "<p>Notes.</p>",
        scanStatus: "scan_not_configured",
        uploadedBy: null,
      });

      expect(await attachments.findByIdForRecord(attachment.id, recordAId)).not.toBeNull();
      expect(await attachments.findByIdForRecord(attachment.id, recordBId)).toBeNull();
    });

    it("deleteForRecord removes the row and reports true, and false for a repeat delete", async () => {
      const recordId = await createRecord();
      const attachment = await attachments.create({
        recordId,
        filename: "sheet.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        sizeBytes: 500,
        checksumSha256: "c".repeat(64),
        blobPathname: "business-knowledge/sheet-def456.xlsx",
        extractedPreviewHtml: "<table></table>",
        scanStatus: "scan_not_configured",
        uploadedBy: null,
      });

      expect(await attachments.deleteForRecord(attachment.id, recordId)).toBe(true);
      expect(await attachments.findByIdForRecord(attachment.id, recordId)).toBeNull();
      expect(await attachments.deleteForRecord(attachment.id, recordId)).toBe(false);
    });

    it("deleteForRecord returns false (does not delete) when the recordId doesn't match — cross-record delete is impossible", async () => {
      const recordAId = await createRecord();
      const recordBId = await createRecord();
      const attachment = await attachments.create({
        recordId: recordAId,
        filename: "doc.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: 200,
        checksumSha256: "d".repeat(64),
        blobPathname: "business-knowledge/doc-ghi789.docx",
        extractedPreviewHtml: "<p>Doc.</p>",
        scanStatus: "scan_not_configured",
        uploadedBy: null,
      });

      expect(await attachments.deleteForRecord(attachment.id, recordBId)).toBe(false);
      expect(await attachments.findByIdForRecord(attachment.id, recordAId)).not.toBeNull();
    });

    it("cascade-deletes attachments when their owning record is hard-deleted at the DB layer", async () => {
      const recordId = await createRecord();
      const attachment = await attachments.create({
        recordId,
        filename: "cascade.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1,
        checksumSha256: "e".repeat(64),
        blobPathname: "business-knowledge/cascade.pdf",
        extractedPreviewHtml: null,
        scanStatus: "scan_not_configured",
        uploadedBy: null,
      });

      // No repository method deletes a business_knowledge_record (ADR-0016, no hard delete via the
      // application layer) — this proves the FK's ON DELETE CASCADE itself, at the DB layer, not
      // any application code path.
      const { getConnection } = await import("../src/connection.js");
      await getConnection().query('DELETE FROM "business_knowledge_records" WHERE id = :id', {
        replacements: { id: recordId },
      });

      expect(await attachments.findByIdForRecord(attachment.id, recordId)).toBeNull();
    });

    it("rejects an invalid scan_status at the database layer (real ENUM constraint)", async () => {
      const recordId = await createRecord();
      await expect(
        attachments.create({
          recordId,
          filename: "bad.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1,
          checksumSha256: "f".repeat(64),
          blobPathname: "business-knowledge/bad.pdf",
          extractedPreviewHtml: null,
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          scanStatus: "not_a_real_status",
          uploadedBy: null,
        }),
      ).rejects.toThrow();
    });
  });
});
