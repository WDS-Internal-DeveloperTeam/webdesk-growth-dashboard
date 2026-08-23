import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  EntityRepository,
  KeywordEntityRelationshipRepository,
  KeywordRepository,
  PageKeywordAssignmentRepository,
} from "../src/keyword-and-entity-library/index.js";
import { PageRepository } from "../src/page-inventory/index.js";
import { ProjectRepository } from "../src/projects/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Keyword & Entity Library schema (migration `00060`) against a REAL, disposable
 * PostgreSQL database. Mirrors `module-page-inventory.integration.test.ts`'s own structure, plus
 * real coverage for the two join tables' unique constraints and `ON DELETE CASCADE` behavior
 * (task package D1) and `page_keyword_assignments.page_id`'s real FK into Page Inventory's own
 * `pages` table.
 */
describe("Keyword & Entity Library module (real disposable database)", () => {
  const keywords = new KeywordRepository();
  const entities = new EntityRepository();
  const relationships = new KeywordEntityRelationshipRepository();
  const assignments = new PageKeywordAssignmentRepository();
  const pages = new PageRepository();
  const projects = new ProjectRepository();

  let counter = 0;
  function uniqueId(prefix: string): string {
    counter += 1;
    return `${prefix}-${Date.now()}-${counter}`;
  }

  async function createProjectFixture(): Promise<string> {
    const project = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Keyword & Entity Library Fixture Project",
    });
    return project.id;
  }

  async function createPageFixture(projectId: string): Promise<string> {
    const page = await pages.create({
      projectId,
      publicId: uniqueId("PAGE"),
      pageName: "Fixture Page",
    });
    return page.id;
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

  describe("KeywordRepository", () => {
    it("creates a keyword defaulting to draft approvalStatus", async () => {
      const projectId = await createProjectFixture();
      const keyword = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "best seo tools",
      });
      expect(keyword.projectId).toBe(projectId);
      expect(keyword.approvalStatus).toBe("draft");
    });

    it("rejects a duplicate publicId at the database layer (global uniqueness, not per-project)", async () => {
      const projectId = await createProjectFixture();
      const publicId = uniqueId("KW");
      await keywords.create({ projectId, publicId, queryText: "first" });
      await expect(keywords.create({ projectId, publicId, queryText: "second" })).rejects.toThrow();
    });

    it("rejects a keyword row with no project_id at the database layer (real NOT NULL FK)", async () => {
      await expect(
        // @ts-expect-error deliberately omitted to prove the DB-level NOT NULL constraint
        keywords.create({ publicId: uniqueId("KW"), queryText: "no project" }),
      ).rejects.toThrow();
    });

    it("rejects a keyword row referencing a nonexistent project_id at the database layer", async () => {
      await expect(
        keywords.create({
          projectId: "00000000-0000-4000-8000-000000000000",
          publicId: uniqueId("KW"),
          queryText: "orphaned",
        }),
      ).rejects.toThrow();
    });

    it("finds by publicId, and returns null for a missing one", async () => {
      const projectId = await createProjectFixture();
      const publicId = uniqueId("KW");
      const created = await keywords.create({ projectId, publicId, queryText: "x" });
      expect((await keywords.findByPublicId(publicId))?.id).toBe(created.id);
      expect(await keywords.findByPublicId("KW-does-not-exist")).toBeNull();
    });

    it("findById returns null for a missing keyword", async () => {
      expect(await keywords.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("list() is scoped to projectId — a keyword in a different project never appears", async () => {
      const projectA = await createProjectFixture();
      const projectB = await createProjectFixture();
      const keywordInA = await keywords.create({
        projectId: projectA,
        publicId: uniqueId("KW"),
        queryText: "in project a",
      });
      await keywords.create({
        projectId: projectB,
        publicId: uniqueId("KW"),
        queryText: "in project b",
      });

      const listA = await keywords.list({ projectId: projectA });
      expect(listA.map((k) => k.id)).toContain(keywordInA.id);
      expect(listA.every((k) => k.projectId === projectA)).toBe(true);
    });

    it("list() filters by approvalStatus and search (case-insensitive, trigram-backed)", async () => {
      const projectId = await createProjectFixture();
      const uniqueQueryText = uniqueId("Unique Searchable Keyword Phrase");
      await keywords.create({ projectId, publicId: uniqueId("KW"), queryText: uniqueQueryText });

      const byStatus = await keywords.list({ projectId, approvalStatus: "draft" });
      expect(byStatus.length).toBeGreaterThanOrEqual(1);

      const bySearch = await keywords.list({
        projectId,
        search: uniqueQueryText.toLowerCase(),
      });
      expect(bySearch.length).toBe(1);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const projectId = await createProjectFixture();
      const result = await keywords.list({ projectId, limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("update() changes content fields and never touches approvalStatus", async () => {
      const projectId = await createProjectFixture();
      const created = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "original",
      });

      const updated = await keywords.update(created.id, { queryText: "renamed" });
      expect(updated?.queryText).toBe("renamed");
      expect(updated?.approvalStatus).toBe("draft");
    });

    it("update() returns null for a missing keyword", async () => {
      expect(
        await keywords.update("00000000-0000-4000-8000-000000000000", { queryText: "x" }),
      ).toBeNull();
    });

    it("update() with a CAS guard succeeds when the expected approvalStatus matches", async () => {
      const projectId = await createProjectFixture();
      const created = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "cas fixture",
      });
      const updated = await keywords.update(created.id, { queryText: "cas updated" }, "draft");
      expect(updated?.queryText).toBe("cas updated");
    });

    it("update() with a CAS guard returns null (no write) when the expected approvalStatus is stale", async () => {
      const projectId = await createProjectFixture();
      const created = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "cas stale fixture",
      });
      // The keyword is really `draft`; claim we expected `approved` — a stale read.
      const result = await keywords.update(
        created.id,
        { queryText: "should not apply" },
        "approved",
      );
      expect(result).toBeNull();

      const stillOriginal = await keywords.findById(created.id);
      expect(stillOriginal?.queryText).toBe("cas stale fixture");
    });

    it("round-trips researchDate as a plain date string", async () => {
      const projectId = await createProjectFixture();
      const created = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "date fixture",
        researchDate: "2027-01-15",
      });
      expect(created.researchDate).toBe("2027-01-15");
    });

    it("updateStatus() changes approvalStatus when the expected current status matches", async () => {
      const projectId = await createProjectFixture();
      const created = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "status fixture",
      });
      const result = await keywords.updateStatus(created.id, "draft", "submitted", null);
      expect(result.outcome).toBe("updated");
      expect(result.outcome === "updated" && result.entity.approvalStatus).toBe("submitted");
    });

    it("updateStatus() reports not_found for a missing keyword", async () => {
      const result = await keywords.updateStatus(
        "00000000-0000-4000-8000-000000000000",
        "draft",
        "submitted",
        null,
      );
      expect(result.outcome).toBe("not_found");
    });

    it("updateStatus() reports conflict (and does not write) on the atomic compare-and-swap", async () => {
      const projectId = await createProjectFixture();
      const created = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "conflict fixture",
      });
      const result = await keywords.updateStatus(created.id, "submitted", "under_review", null);
      expect(result.outcome).toBe("conflict");
      expect(result.outcome === "conflict" && result.entity.approvalStatus).toBe("draft");

      const stillDraft = await keywords.findById(created.id);
      expect(stillDraft?.approvalStatus).toBe("draft");
    });

    it("rejects an invalid approvalStatus at the database layer (real ENUM constraint)", async () => {
      const projectId = await createProjectFixture();
      const created = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "enum fixture",
      });
      await expect(
        // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
        keywords.updateStatus(created.id, "draft", "not_a_real_status", null),
      ).rejects.toThrow();
    });

    it("rejects an invalid confidence value at the database layer (real ENUM constraint)", async () => {
      const projectId = await createProjectFixture();
      await expect(
        keywords.create({
          projectId,
          publicId: uniqueId("KW"),
          queryText: "confidence fixture",
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          confidence: "extreme",
        }),
      ).rejects.toThrow();
    });
  });

  describe("EntityRepository", () => {
    it("creates an entity with no approvalStatus concept (task package D3)", async () => {
      const projectId = await createProjectFixture();
      const entity = await entities.create({
        projectId,
        publicId: uniqueId("ENT"),
        name: "Acme Corp",
      });
      expect(entity.projectId).toBe(projectId);
      expect(entity).not.toHaveProperty("approvalStatus");
    });

    it("rejects a duplicate publicId at the database layer", async () => {
      const projectId = await createProjectFixture();
      const publicId = uniqueId("ENT");
      await entities.create({ projectId, publicId, name: "First" });
      await expect(entities.create({ projectId, publicId, name: "Second" })).rejects.toThrow();
    });

    it("findByIds is scoped to projectId — an entity in a different project is excluded", async () => {
      const projectA = await createProjectFixture();
      const projectB = await createProjectFixture();
      const entityInA = await entities.create({
        projectId: projectA,
        publicId: uniqueId("ENT"),
        name: "In A",
      });
      const entityInB = await entities.create({
        projectId: projectB,
        publicId: uniqueId("ENT"),
        name: "In B",
      });

      const found = await entities.findByIds([entityInA.id, entityInB.id], projectA);
      expect(found.map((e) => e.id)).toEqual([entityInA.id]);
    });

    it("findByIds returns an empty array for an empty input without querying", async () => {
      const projectId = await createProjectFixture();
      expect(await entities.findByIds([], projectId)).toEqual([]);
    });

    it("list() filters by search (case-insensitive, trigram-backed)", async () => {
      const projectId = await createProjectFixture();
      const uniqueName = uniqueId("Unique Searchable Entity Name");
      await entities.create({ projectId, publicId: uniqueId("ENT"), name: uniqueName });

      const bySearch = await entities.list({ projectId, search: uniqueName.toLowerCase() });
      expect(bySearch.length).toBe(1);
    });

    it("update() changes content fields", async () => {
      const projectId = await createProjectFixture();
      const created = await entities.create({
        projectId,
        publicId: uniqueId("ENT"),
        name: "Original",
      });
      const updated = await entities.update(created.id, { name: "Renamed" });
      expect(updated?.name).toBe("Renamed");
    });

    it("remove() is scoped to projectId — an entity from a different project is not removed (IDOR fix)", async () => {
      const projectA = await createProjectFixture();
      const projectB = await createProjectFixture();
      const entity = await entities.create({
        projectId: projectA,
        publicId: uniqueId("ENT"),
        name: "Belongs To A",
      });

      const wrongScopeRemoved = await entities.remove(entity.id, projectB);
      expect(wrongScopeRemoved).toBe(false);
      expect(await entities.findById(entity.id)).not.toBeNull();

      const correctScopeRemoved = await entities.remove(entity.id, projectA);
      expect(correctScopeRemoved).toBe(true);
      expect(await entities.findById(entity.id)).toBeNull();
    });
  });

  describe("KeywordEntityRelationshipRepository", () => {
    it("creates a relationship and lists it back for the keyword", async () => {
      const projectId = await createProjectFixture();
      const keyword = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "relationship fixture",
      });
      const entity = await entities.create({
        projectId,
        publicId: uniqueId("ENT"),
        name: "Relationship Entity",
      });

      const relationship = await relationships.create(keyword.id, entity.id, null);
      expect(relationship.keywordId).toBe(keyword.id);
      expect(relationship.entityId).toBe(entity.id);

      const listed = await relationships.listForKeyword(keyword.id);
      expect(listed.map((r) => r.id)).toContain(relationship.id);
    });

    it("enforces a unique (keywordId, entityId) pair at the database layer", async () => {
      const projectId = await createProjectFixture();
      const keyword = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "unique relationship fixture",
      });
      const entity = await entities.create({
        projectId,
        publicId: uniqueId("ENT"),
        name: "Unique Relationship Entity",
      });

      await relationships.create(keyword.id, entity.id, null);
      await expect(relationships.create(keyword.id, entity.id, null)).rejects.toThrow();
    });

    it("remove() is scoped to keywordId — a relationship from a different keyword is not removed (IDOR fix)", async () => {
      const projectId = await createProjectFixture();
      const keywordA = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "keyword a",
      });
      const keywordB = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "keyword b",
      });
      const entity = await entities.create({
        projectId,
        publicId: uniqueId("ENT"),
        name: "IDOR Entity",
      });
      const relationship = await relationships.create(keywordA.id, entity.id, null);

      const wrongScopeRemoved = await relationships.remove(relationship.id, keywordB.id);
      expect(wrongScopeRemoved).toBe(false);

      const correctScopeRemoved = await relationships.remove(relationship.id, keywordA.id);
      expect(correctScopeRemoved).toBe(true);
    });

    it("cascades: deleting the parent keyword also deletes its relationship rows", async () => {
      const projectId = await createProjectFixture();
      const keyword = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "cascade keyword fixture",
      });
      const entity = await entities.create({
        projectId,
        publicId: uniqueId("ENT"),
        name: "Cascade Keyword Entity",
      });
      const relationship = await relationships.create(keyword.id, entity.id, null);

      const { getConnection } = await import("../src/connection.js");
      await getConnection().query("DELETE FROM keywords WHERE id = :id", {
        replacements: { id: keyword.id },
      });

      const listed = await relationships.listForKeyword(keyword.id);
      expect(listed.map((r) => r.id)).not.toContain(relationship.id);
    });

    it("cascades: deleting the parent entity also deletes its relationship rows", async () => {
      const projectId = await createProjectFixture();
      const keyword = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "cascade entity fixture",
      });
      const entity = await entities.create({
        projectId,
        publicId: uniqueId("ENT"),
        name: "Cascade Entity",
      });
      const relationship = await relationships.create(keyword.id, entity.id, null);

      const { getConnection } = await import("../src/connection.js");
      await getConnection().query("DELETE FROM entities WHERE id = :id", {
        replacements: { id: entity.id },
      });

      const listed = await relationships.listForKeyword(keyword.id);
      expect(listed.map((r) => r.id)).not.toContain(relationship.id);
    });
  });

  describe("PageKeywordAssignmentRepository", () => {
    it("creates an assignment against a real Page Inventory page and lists it back", async () => {
      const projectId = await createProjectFixture();
      const keyword = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "assignment fixture",
      });
      const pageId = await createPageFixture(projectId);

      const assignment = await assignments.create({
        keywordId: keyword.id,
        pageId,
        assignmentNote: "primary target",
        createdBy: null,
      });
      expect(assignment.keywordId).toBe(keyword.id);
      expect(assignment.pageId).toBe(pageId);
      expect(assignment.assignmentNote).toBe("primary target");

      const listed = await assignments.listForKeyword(keyword.id);
      expect(listed.map((a) => a.id)).toContain(assignment.id);
    });

    it("rejects an assignment referencing a nonexistent page_id at the database layer (real FK constraint)", async () => {
      const projectId = await createProjectFixture();
      const keyword = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "orphaned assignment fixture",
      });

      await expect(
        assignments.create({
          keywordId: keyword.id,
          pageId: "00000000-0000-4000-8000-000000000000",
          createdBy: null,
        }),
      ).rejects.toThrow();
    });

    it("enforces a unique (keywordId, pageId) pair at the database layer", async () => {
      const projectId = await createProjectFixture();
      const keyword = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "unique assignment fixture",
      });
      const pageId = await createPageFixture(projectId);

      await assignments.create({ keywordId: keyword.id, pageId, createdBy: null });
      await expect(
        assignments.create({ keywordId: keyword.id, pageId, createdBy: null }),
      ).rejects.toThrow();
    });

    it("remove() is scoped to keywordId — an assignment from a different keyword is not removed (IDOR fix)", async () => {
      const projectId = await createProjectFixture();
      const keywordA = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "assignment keyword a",
      });
      const keywordB = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "assignment keyword b",
      });
      const pageId = await createPageFixture(projectId);
      const assignment = await assignments.create({
        keywordId: keywordA.id,
        pageId,
        createdBy: null,
      });

      const wrongScopeRemoved = await assignments.remove(assignment.id, keywordB.id);
      expect(wrongScopeRemoved).toBe(false);

      const correctScopeRemoved = await assignments.remove(assignment.id, keywordA.id);
      expect(correctScopeRemoved).toBe(true);
    });

    it("cascades: deleting the parent keyword also deletes its assignment rows", async () => {
      const projectId = await createProjectFixture();
      const keyword = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "cascade assignment keyword fixture",
      });
      const pageId = await createPageFixture(projectId);
      const assignment = await assignments.create({
        keywordId: keyword.id,
        pageId,
        createdBy: null,
      });

      const { getConnection } = await import("../src/connection.js");
      await getConnection().query("DELETE FROM keywords WHERE id = :id", {
        replacements: { id: keyword.id },
      });

      const listed = await assignments.listForKeyword(keyword.id);
      expect(listed.map((a) => a.id)).not.toContain(assignment.id);
    });

    it("cascades: deleting the parent page (Page Inventory) also deletes its assignment rows", async () => {
      const projectId = await createProjectFixture();
      const keyword = await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "cascade assignment page fixture",
      });
      const pageId = await createPageFixture(projectId);
      const assignment = await assignments.create({
        keywordId: keyword.id,
        pageId,
        createdBy: null,
      });

      const { getConnection } = await import("../src/connection.js");
      await getConnection().query("DELETE FROM pages WHERE id = :id", {
        replacements: { id: pageId },
      });

      const listed = await assignments.listForKeyword(keyword.id);
      expect(listed.map((a) => a.id)).not.toContain(assignment.id);
    });
  });

  describe("Project-scoping RESTRICT behavior (task package rule 7 precedent)", () => {
    it("rejects deleting a project that still has keywords (RESTRICT, not CASCADE)", async () => {
      const projectId = await createProjectFixture();
      await keywords.create({
        projectId,
        publicId: uniqueId("KW"),
        queryText: "blocks project delete",
      });

      const { getConnection } = await import("../src/connection.js");
      await expect(
        getConnection().query("DELETE FROM projects WHERE id = :id", {
          replacements: { id: projectId },
        }),
      ).rejects.toThrow();
    });

    it("rejects deleting a project that still has entities (RESTRICT, not CASCADE)", async () => {
      const projectId = await createProjectFixture();
      await entities.create({
        projectId,
        publicId: uniqueId("ENT"),
        name: "Blocks project delete",
      });

      const { getConnection } = await import("../src/connection.js");
      await expect(
        getConnection().query("DELETE FROM projects WHERE id = :id", {
          replacements: { id: projectId },
        }),
      ).rejects.toThrow();
    });
  });
});
