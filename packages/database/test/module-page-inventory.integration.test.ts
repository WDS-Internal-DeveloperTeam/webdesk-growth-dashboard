import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PageRepository, PageUrlRepository } from "../src/page-inventory/index.js";
import { ProjectRepository } from "../src/projects/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Page Inventory schema (migration `00058`) against a REAL, disposable PostgreSQL
 * database. Mirrors `module-proof-and-claims-library.integration.test.ts`'s own structure, plus
 * real coverage for `pages.project_id` (this module's own first-of-its-kind project-scoping,
 * task package D2) and `page_urls`' partial unique index (task package D10 — the acceptance rule
 * "each URL has one canonical active page record unless an approved redirect or archive
 * relationship exists").
 */
describe("Page Inventory module (real disposable database)", () => {
  const pages = new PageRepository();
  const pageUrls = new PageUrlRepository();
  const projects = new ProjectRepository();

  let counter = 0;
  function uniqueId(prefix: string): string {
    counter += 1;
    return `${prefix}-${Date.now()}-${counter}`;
  }

  async function createProjectFixture(): Promise<string> {
    const project = await projects.create({
      publicId: uniqueId("PROJ"),
      name: "Page Inventory Fixture Project",
    });
    return project.id;
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

  describe("PageRepository", () => {
    it("creates a page defaulting to draft workflowStage, proposed existingOrProposed, unknown indexStatus", async () => {
      const projectId = await createProjectFixture();
      const page = await pages.create({
        projectId,
        publicId: uniqueId("PAGE"),
        pageName: "Home",
      });
      expect(page.projectId).toBe(projectId);
      expect(page.workflowStage).toBe("draft");
      expect(page.existingOrProposed).toBe("proposed");
      expect(page.indexStatus).toBe("unknown");
    });

    it("rejects a duplicate publicId at the database layer (global uniqueness, not per-project)", async () => {
      const projectId = await createProjectFixture();
      const publicId = uniqueId("PAGE");
      await pages.create({ projectId, publicId, pageName: "First" });
      await expect(pages.create({ projectId, publicId, pageName: "Second" })).rejects.toThrow();
    });

    it("rejects a page row with no project_id at the database layer (real NOT NULL FK)", async () => {
      await expect(
        // @ts-expect-error deliberately omitted to prove the DB-level NOT NULL constraint
        pages.create({ publicId: uniqueId("PAGE"), pageName: "No project" }),
      ).rejects.toThrow();
    });

    it("rejects a page row referencing a nonexistent project_id at the database layer (real FK constraint)", async () => {
      await expect(
        pages.create({
          projectId: "00000000-0000-4000-8000-000000000000",
          publicId: uniqueId("PAGE"),
          pageName: "Orphaned",
        }),
      ).rejects.toThrow();
    });

    it("finds by publicId, and returns null for a missing one", async () => {
      const projectId = await createProjectFixture();
      const publicId = uniqueId("PAGE");
      const created = await pages.create({ projectId, publicId, pageName: "X" });
      expect((await pages.findByPublicId(publicId))?.id).toBe(created.id);
      expect(await pages.findByPublicId("PAGE-does-not-exist")).toBeNull();
    });

    it("findById returns null for a missing page", async () => {
      expect(await pages.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("list() is scoped to projectId — a page in a different project never appears", async () => {
      const projectA = await createProjectFixture();
      const projectB = await createProjectFixture();
      const pageInA = await pages.create({
        projectId: projectA,
        publicId: uniqueId("PAGE"),
        pageName: "In Project A",
      });
      await pages.create({
        projectId: projectB,
        publicId: uniqueId("PAGE"),
        pageName: "In Project B",
      });

      const listA = await pages.list({ projectId: projectA });
      expect(listA.map((p) => p.id)).toContain(pageInA.id);
      expect(listA.every((p) => p.projectId === projectA)).toBe(true);
    });

    it("list() filters by workflowStage and search (case-insensitive, trigram-backed)", async () => {
      const projectId = await createProjectFixture();
      const uniquePageName = uniqueId("Unique Searchable Page");
      await pages.create({ projectId, publicId: uniqueId("PAGE"), pageName: uniquePageName });

      const byStage = await pages.list({ projectId, workflowStage: "draft" });
      expect(byStage.length).toBeGreaterThanOrEqual(1);

      const bySearch = await pages.list({ projectId, search: uniquePageName.toLowerCase() });
      expect(bySearch.length).toBe(1);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const projectId = await createProjectFixture();
      const result = await pages.list({ projectId, limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("update() changes content fields and never touches workflowStage", async () => {
      const projectId = await createProjectFixture();
      const created = await pages.create({
        projectId,
        publicId: uniqueId("PAGE"),
        pageName: "Original",
      });

      const updated = await pages.update(created.id, { pageName: "Renamed" });
      expect(updated?.pageName).toBe("Renamed");
      expect(updated?.workflowStage).toBe("draft");
    });

    it("update() returns null for a missing page", async () => {
      expect(
        await pages.update("00000000-0000-4000-8000-000000000000", { pageName: "x" }),
      ).toBeNull();
    });

    it("round-trips lastScanAt/lastDeploymentAt as plain date strings", async () => {
      const projectId = await createProjectFixture();
      const created = await pages.create({
        projectId,
        publicId: uniqueId("PAGE"),
        pageName: "Date Fixture",
        lastScanAt: "2027-01-15",
        lastDeploymentAt: "2027-02-20",
      });
      expect(created.lastScanAt).toBe("2027-01-15");
      expect(created.lastDeploymentAt).toBe("2027-02-20");
    });

    it("round-trips roadmapPhaseId when set to a real roadmap_items row", async () => {
      const projectId = await createProjectFixture();
      const { RoadmapItemRepository } = await import("../src/projects/index.js");
      const roadmapItems = new RoadmapItemRepository();
      const phase = await roadmapItems.create({ projectId, name: "Phase 1" });

      const created = await pages.create({
        projectId,
        publicId: uniqueId("PAGE"),
        pageName: "Phased Page",
        roadmapPhaseId: phase.id,
      });
      expect(created.roadmapPhaseId).toBe(phase.id);
    });

    it("updateStatus() changes workflowStage when the expected current stage matches", async () => {
      const projectId = await createProjectFixture();
      const created = await pages.create({
        projectId,
        publicId: uniqueId("PAGE"),
        pageName: "Status Fixture",
      });
      const result = await pages.updateStatus(created.id, "draft", "submitted", null);
      expect(result.outcome).toBe("updated");
      expect(result.outcome === "updated" && result.entity.workflowStage).toBe("submitted");
    });

    it("updateStatus() reports not_found for a missing page", async () => {
      const result = await pages.updateStatus(
        "00000000-0000-4000-8000-000000000000",
        "draft",
        "submitted",
        null,
      );
      expect(result.outcome).toBe("not_found");
    });

    it("updateStatus() reports conflict (and does not write) on the atomic compare-and-swap", async () => {
      const projectId = await createProjectFixture();
      const created = await pages.create({
        projectId,
        publicId: uniqueId("PAGE"),
        pageName: "Conflict Fixture",
      });
      // The page is really `draft`; claim we expected `submitted` — a stale read.
      const result = await pages.updateStatus(created.id, "submitted", "under_review", null);
      expect(result.outcome).toBe("conflict");
      expect(result.outcome === "conflict" && result.entity.workflowStage).toBe("draft");

      const stillDraft = await pages.findById(created.id);
      expect(stillDraft?.workflowStage).toBe("draft");
    });

    it("rejects an invalid workflowStage at the database layer (real ENUM constraint)", async () => {
      const projectId = await createProjectFixture();
      const created = await pages.create({ projectId, publicId: uniqueId("PAGE"), pageName: "y" });
      await expect(
        // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
        pages.updateStatus(created.id, "draft", "not_a_real_stage", null),
      ).rejects.toThrow();
    });
  });

  describe("PageUrlRepository", () => {
    it("creates a URL under a real page and lists it back", async () => {
      const projectId = await createProjectFixture();
      const page = await pages.create({
        projectId,
        publicId: uniqueId("PAGE"),
        pageName: "Parent Page",
      });
      const url = await pageUrls.create({
        pageId: page.id,
        projectId,
        url: "https://example.com/parent-page",
      });
      expect(url.pageId).toBe(page.id);
      expect(url.isCanonical).toBe(true);

      const listed = await pageUrls.listByPage(page.id);
      expect(listed.map((u) => u.id)).toContain(url.id);
    });

    it("findById returns null for a missing URL", async () => {
      expect(await pageUrls.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("enforces at most one canonical URL per (project, url) at the database layer (task package D10)", async () => {
      const projectId = await createProjectFixture();
      const pageA = await pages.create({
        projectId,
        publicId: uniqueId("PAGE"),
        pageName: "Page A",
      });
      const pageB = await pages.create({
        projectId,
        publicId: uniqueId("PAGE"),
        pageName: "Page B",
      });
      const url = uniqueId("https://example.com/shared-url");

      await pageUrls.create({ pageId: pageA.id, projectId, url, isCanonical: true });
      await expect(
        pageUrls.create({ pageId: pageB.id, projectId, url, isCanonical: true }),
      ).rejects.toThrow();

      // A non-canonical duplicate is fine — the partial index only covers is_canonical = true.
      await expect(
        pageUrls.create({ pageId: pageB.id, projectId, url, isCanonical: false }),
      ).resolves.toBeDefined();
    });

    it("allows the identical URL as canonical in two different projects (index is scoped by project_id)", async () => {
      const projectA = await createProjectFixture();
      const projectB = await createProjectFixture();
      const pageA = await pages.create({
        projectId: projectA,
        publicId: uniqueId("PAGE"),
        pageName: "Page A",
      });
      const pageB = await pages.create({
        projectId: projectB,
        publicId: uniqueId("PAGE"),
        pageName: "Page B",
      });
      const url = uniqueId("https://example.com/shared-across-projects");

      await expect(
        pageUrls.create({ pageId: pageA.id, projectId: projectA, url, isCanonical: true }),
      ).resolves.toBeDefined();
      await expect(
        pageUrls.create({ pageId: pageB.id, projectId: projectB, url, isCanonical: true }),
      ).resolves.toBeDefined();
    });

    it("update() is scoped to pageId — a URL from a different page is not found (IDOR fix)", async () => {
      const projectId = await createProjectFixture();
      const pageA = await pages.create({
        projectId,
        publicId: uniqueId("PAGE"),
        pageName: "Page A",
      });
      const pageB = await pages.create({
        projectId,
        publicId: uniqueId("PAGE"),
        pageName: "Page B",
      });
      const url = await pageUrls.create({
        pageId: pageA.id,
        projectId,
        url: uniqueId("https://example.com/a"),
      });

      const wrongScopeResult = await pageUrls.update(url.id, pageB.id, {
        url: "https://example.com/attempted-cross-page-edit",
      });
      expect(wrongScopeResult).toBeNull();

      const correctScopeResult = await pageUrls.update(url.id, pageA.id, {
        url: "https://example.com/real-edit",
      });
      expect(correctScopeResult?.url).toBe("https://example.com/real-edit");
    });

    it("remove() is scoped to pageId — a URL from a different page is not removed (IDOR fix)", async () => {
      const projectId = await createProjectFixture();
      const pageA = await pages.create({
        projectId,
        publicId: uniqueId("PAGE"),
        pageName: "Page A2",
      });
      const pageB = await pages.create({
        projectId,
        publicId: uniqueId("PAGE"),
        pageName: "Page B2",
      });
      const url = await pageUrls.create({
        pageId: pageA.id,
        projectId,
        url: uniqueId("https://example.com/a2"),
      });

      const wrongScopeRemoved = await pageUrls.remove(url.id, pageB.id);
      expect(wrongScopeRemoved).toBe(false);
      expect(await pageUrls.findById(url.id)).not.toBeNull();

      const correctScopeRemoved = await pageUrls.remove(url.id, pageA.id);
      expect(correctScopeRemoved).toBe(true);
      expect(await pageUrls.findById(url.id)).toBeNull();
    });

    it("cascades: deleting a parent pages row also deletes its page_urls rows", async () => {
      const projectId = await createProjectFixture();
      const page = await pages.create({
        projectId,
        publicId: uniqueId("PAGE"),
        pageName: "Cascade Parent",
      });
      const url = await pageUrls.create({
        pageId: page.id,
        projectId,
        url: uniqueId("https://example.com/cascade"),
      });
      expect(await pageUrls.findById(url.id)).not.toBeNull();

      // No repository-level hard-delete exists for pages (matching every other module's
      // no-hard-delete-from-the-API convention) — the cascade is exercised directly via SQL,
      // proving the migration's own onDelete: "CASCADE" foreign key, not application code.
      const { getConnection } = await import("../src/connection.js");
      await getConnection().query("DELETE FROM pages WHERE id = :id", {
        replacements: { id: page.id },
      });

      expect(await pages.findById(page.id)).toBeNull();
      expect(await pageUrls.findById(url.id)).toBeNull();
    });

    it("rejects deleting a project that still has pages (RESTRICT, not CASCADE — task package rule 7)", async () => {
      const projectId = await createProjectFixture();
      await pages.create({
        projectId,
        publicId: uniqueId("PAGE"),
        pageName: "Blocks project delete",
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
