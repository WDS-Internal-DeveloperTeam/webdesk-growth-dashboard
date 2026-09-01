import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CaseStudyLibraryRecordRepository } from "../src/case-study-library/index.js";
import { CaseStudyRepository } from "../src/case-study-studio/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Case Study Library schema (migration `00093`) against a REAL, disposable
 * PostgreSQL database. Mirrors ../test/module-case-study-studio.integration.test.ts's own
 * structure — this table is an EXTENSION over `case_studies` (D1), so every fixture creates a real
 * parent case study first via `CaseStudyRepository`.
 */
describe("Case Study Library module (real disposable database)", () => {
  const caseStudies = new CaseStudyRepository();
  const records = new CaseStudyLibraryRecordRepository();

  let counter = 0;
  function uniqueId(prefix: string): string {
    counter += 1;
    return `${prefix}-${Date.now()}-${counter}`;
  }

  async function createParentCaseStudy(): Promise<string> {
    const cs = await caseStudies.create({
      publicId: uniqueId("CS"),
      clientName: "A",
      projectTitle: "Parent",
    });
    return cs.id;
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

  describe("CaseStudyLibraryRecordRepository", () => {
    it("creates a record extending a real case study, defaulting to empty arrays/testimonials", async () => {
      const caseStudyId = await createParentCaseStudy();
      const record = await records.create({ publicId: uniqueId("CSL"), caseStudyId });
      expect(record.caseStudyId).toBe(caseStudyId);
      expect(record.relatedPageIds).toEqual([]);
      expect(record.technologies).toEqual([]);
      expect(record.testimonials).toEqual([]);
    });

    it("round-trips relatedPageIds/technologies/testimonials", async () => {
      const caseStudyId = await createParentCaseStudy();
      const record = await records.create({
        publicId: uniqueId("CSL"),
        caseStudyId,
        relatedPageIds: ["PAGE-1", "PAGE-2"],
        technologies: ["Next.js", "PostgreSQL"],
        testimonials: [{ quote: "Great work!", author: "Jane Doe", role: "VP Marketing" }],
      });
      const found = await records.findById(record.id);
      expect(found?.relatedPageIds).toEqual(["PAGE-1", "PAGE-2"]);
      expect(found?.technologies).toEqual(["Next.js", "PostgreSQL"]);
      expect(found?.testimonials).toEqual([
        { quote: "Great work!", author: "Jane Doe", role: "VP Marketing" },
      ]);
    });

    it("rejects a duplicate publicId at the database layer", async () => {
      const publicId = uniqueId("CSL");
      const caseStudyIdA = await createParentCaseStudy();
      const caseStudyIdB = await createParentCaseStudy();
      await records.create({ publicId, caseStudyId: caseStudyIdA });
      await expect(records.create({ publicId, caseStudyId: caseStudyIdB })).rejects.toThrow();
    });

    it("rejects a second record for the same case study (one library record per case study)", async () => {
      const caseStudyId = await createParentCaseStudy();
      await records.create({ publicId: uniqueId("CSL"), caseStudyId });
      await expect(records.create({ publicId: uniqueId("CSL"), caseStudyId })).rejects.toThrow();
    });

    it("rejects a caseStudyId that does not reference a real case study (real DB-level FK)", async () => {
      await expect(
        records.create({
          publicId: uniqueId("CSL"),
          caseStudyId: "00000000-0000-4000-8000-000000000000",
        }),
      ).rejects.toThrow();
    });

    it("findByCaseStudyId finds the one record and returns null when none exists", async () => {
      const caseStudyId = await createParentCaseStudy();
      expect(await records.findByCaseStudyId(caseStudyId)).toBeNull();
      const created = await records.create({ publicId: uniqueId("CSL"), caseStudyId });
      expect((await records.findByCaseStudyId(caseStudyId))?.id).toBe(created.id);
    });

    it("findByPublicId finds by publicId, and returns null for a missing one", async () => {
      const publicId = uniqueId("CSL");
      const caseStudyId = await createParentCaseStudy();
      const created = await records.create({ publicId, caseStudyId });
      expect((await records.findByPublicId(publicId))?.id).toBe(created.id);
      expect(await records.findByPublicId("CSL-does-not-exist")).toBeNull();
    });

    it("findById returns null for a missing record", async () => {
      expect(await records.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("list() matches search against technologies and testimonial quotes (case-insensitive)", async () => {
      const uniqueTech = uniqueId("UniqueSearchableTechnology");
      const caseStudyId = await createParentCaseStudy();
      await records.create({
        publicId: uniqueId("CSL"),
        caseStudyId,
        technologies: [uniqueTech],
      });

      const byTech = await records.list({ search: uniqueTech.toLowerCase() });
      expect(byTech.length).toBe(1);

      const uniqueQuote = uniqueId("UniqueSearchableQuoteText");
      const caseStudyId2 = await createParentCaseStudy();
      await records.create({
        publicId: uniqueId("CSL"),
        caseStudyId: caseStudyId2,
        testimonials: [{ quote: uniqueQuote, author: null, role: null }],
      });
      const byQuote = await records.list({ search: uniqueQuote.toLowerCase() });
      expect(byQuote.length).toBe(1);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await records.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("update() changes content fields and never touches publicId/caseStudyId", async () => {
      const caseStudyId = await createParentCaseStudy();
      const created = await records.create({
        publicId: uniqueId("CSL"),
        caseStudyId,
        technologies: ["React"],
      });

      const updated = await records.update(created.id, { technologies: ["React", "Vue"] });
      expect(updated?.technologies).toEqual(["React", "Vue"]);
      expect(updated?.caseStudyId).toBe(caseStudyId);
    });

    it("update() returns null for a missing record", async () => {
      expect(
        await records.update("00000000-0000-4000-8000-000000000000", { technologies: ["x"] }),
      ).toBeNull();
    });

    it("update() normalizes an explicit null on an array/JSONB field to empty, and leaves an omitted field untouched", async () => {
      const caseStudyId = await createParentCaseStudy();
      const created = await records.create({
        publicId: uniqueId("CSL"),
        caseStudyId,
        relatedPageIds: ["PAGE-1"],
        technologies: ["React"],
        testimonials: [{ quote: "Nice", author: null, role: null }],
      });

      const updated = await records.update(created.id, {
        relatedPageIds: null,
        testimonials: null,
      });
      expect(updated?.relatedPageIds).toEqual([]);
      expect(updated?.testimonials).toEqual([]);
      expect(updated?.technologies).toEqual(["React"]);
    });

    it("is blocked from deletion by the real RESTRICT FK when the parent case study is deleted", async () => {
      const caseStudyId = await createParentCaseStudy();
      await records.create({ publicId: uniqueId("CSL"), caseStudyId });

      const { getConnection } = await import("../src/connection.js");
      await expect(
        getConnection().query("DELETE FROM case_studies WHERE id = :id", {
          replacements: { id: caseStudyId },
        }),
      ).rejects.toThrow();
    });
  });
});
