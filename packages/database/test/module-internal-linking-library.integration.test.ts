import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InternalLinkRepository } from "../src/internal-linking-library/index.js";
import { PageRepository } from "../src/page-inventory/index.js";
import { ProjectRepository } from "../src/projects/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Internal Linking Library schema (migration `00062`) against a REAL, disposable
 * PostgreSQL database. Mirrors `module-keyword-and-entity-library.integration.test.ts`'s own
 * structure, plus real coverage for the one genuinely new mechanism this module introduces: the
 * atomic, conditional `COALESCE`-based `implementedAt`/`verifiedAt` stamping baked into
 * `updateStatus()`'s own compare-and-swap write (task package D2).
 */
describe("Internal Linking Library module (real disposable database)", () => {
  const links = new InternalLinkRepository();
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
      name: "Internal Linking Library Fixture Project",
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

  describe("InternalLinkRepository", () => {
    it("creates a link defaulting to proposed status", async () => {
      const projectId = await createProjectFixture();
      const sourcePageId = await createPageFixture(projectId);
      const targetPageId = await createPageFixture(projectId);
      const link = await links.create({
        projectId,
        publicId: uniqueId("LINK"),
        sourcePageId,
        targetPageId,
      });
      expect(link.projectId).toBe(projectId);
      expect(link.status).toBe("proposed");
      expect(link.implementedAt).toBeNull();
      expect(link.verifiedAt).toBeNull();
    });

    it("rejects a duplicate publicId at the database layer (global uniqueness, not per-project)", async () => {
      const projectId = await createProjectFixture();
      const sourcePageId = await createPageFixture(projectId);
      const targetPageId = await createPageFixture(projectId);
      const publicId = uniqueId("LINK");
      await links.create({ projectId, publicId, sourcePageId, targetPageId });
      await expect(
        links.create({ projectId, publicId, sourcePageId, targetPageId }),
      ).rejects.toThrow();
    });

    it("rejects a link row with no project_id at the database layer (real NOT NULL FK)", async () => {
      const projectId = await createProjectFixture();
      const sourcePageId = await createPageFixture(projectId);
      const targetPageId = await createPageFixture(projectId);
      await expect(
        // @ts-expect-error deliberately omitted to prove the DB-level NOT NULL constraint
        links.create({ publicId: uniqueId("LINK"), sourcePageId, targetPageId }),
      ).rejects.toThrow();
    });

    it("rejects a link row referencing a nonexistent project_id at the database layer", async () => {
      const projectId = await createProjectFixture();
      const sourcePageId = await createPageFixture(projectId);
      const targetPageId = await createPageFixture(projectId);
      await expect(
        links.create({
          projectId: "00000000-0000-4000-8000-000000000000",
          publicId: uniqueId("LINK"),
          sourcePageId,
          targetPageId,
        }),
      ).rejects.toThrow();
    });

    it("rejects a link row referencing a nonexistent source_page_id at the database layer", async () => {
      const projectId = await createProjectFixture();
      const targetPageId = await createPageFixture(projectId);
      await expect(
        links.create({
          projectId,
          publicId: uniqueId("LINK"),
          sourcePageId: "00000000-0000-4000-8000-000000000000",
          targetPageId,
        }),
      ).rejects.toThrow();
    });

    it("rejects a link row referencing a nonexistent target_page_id at the database layer", async () => {
      const projectId = await createProjectFixture();
      const sourcePageId = await createPageFixture(projectId);
      await expect(
        links.create({
          projectId,
          publicId: uniqueId("LINK"),
          sourcePageId,
          targetPageId: "00000000-0000-4000-8000-000000000000",
        }),
      ).rejects.toThrow();
    });

    it("finds by publicId, and returns null for a missing one", async () => {
      const projectId = await createProjectFixture();
      const sourcePageId = await createPageFixture(projectId);
      const targetPageId = await createPageFixture(projectId);
      const publicId = uniqueId("LINK");
      const created = await links.create({ projectId, publicId, sourcePageId, targetPageId });
      expect((await links.findByPublicId(publicId))?.id).toBe(created.id);
      expect(await links.findByPublicId("LINK-does-not-exist")).toBeNull();
    });

    it("findById returns null for a missing link", async () => {
      expect(await links.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("list() is scoped to projectId — a link in a different project never appears", async () => {
      const projectA = await createProjectFixture();
      const projectB = await createProjectFixture();
      const sourceA = await createPageFixture(projectA);
      const targetA = await createPageFixture(projectA);
      const sourceB = await createPageFixture(projectB);
      const targetB = await createPageFixture(projectB);
      const linkInA = await links.create({
        projectId: projectA,
        publicId: uniqueId("LINK"),
        sourcePageId: sourceA,
        targetPageId: targetA,
      });
      await links.create({
        projectId: projectB,
        publicId: uniqueId("LINK"),
        sourcePageId: sourceB,
        targetPageId: targetB,
      });

      const listA = await links.list({ projectId: projectA });
      expect(listA.map((l) => l.id)).toContain(linkInA.id);
      expect(listA.every((l) => l.projectId === projectA)).toBe(true);
    });

    it("list() filters by status, priority, sourcePageId/targetPageId, and search (case-insensitive, trigram-backed)", async () => {
      const projectId = await createProjectFixture();
      const sourcePageId = await createPageFixture(projectId);
      const targetPageId = await createPageFixture(projectId);
      const uniqueAnchor = uniqueId("Unique Searchable Anchor Text");
      const created = await links.create({
        projectId,
        publicId: uniqueId("LINK"),
        sourcePageId,
        targetPageId,
        anchor: uniqueAnchor,
        priority: "high",
      });

      const byStatus = await links.list({ projectId, status: "proposed" });
      expect(byStatus.map((l) => l.id)).toContain(created.id);

      const byPriority = await links.list({ projectId, priority: "high" });
      expect(byPriority.map((l) => l.id)).toContain(created.id);

      const bySource = await links.list({ projectId, sourcePageId });
      expect(bySource.map((l) => l.id)).toContain(created.id);

      const byTarget = await links.list({ projectId, targetPageId });
      expect(byTarget.map((l) => l.id)).toContain(created.id);

      const bySearch = await links.list({
        projectId,
        search: uniqueAnchor.toLowerCase(),
      });
      expect(bySearch.map((l) => l.id)).toContain(created.id);
    });

    it("update() edits content fields without touching status", async () => {
      const projectId = await createProjectFixture();
      const sourcePageId = await createPageFixture(projectId);
      const targetPageId = await createPageFixture(projectId);
      const created = await links.create({
        projectId,
        publicId: uniqueId("LINK"),
        sourcePageId,
        targetPageId,
      });
      const updated = await links.update(created.id, { anchor: "Read more" });
      expect(updated?.anchor).toBe("Read more");
      expect(updated?.status).toBe("proposed");
    });

    it("update() returns null for a missing link", async () => {
      expect(
        await links.update("00000000-0000-4000-8000-000000000000", { anchor: "x" }),
      ).toBeNull();
    });

    it("update() with a CAS guard succeeds when the expected status matches", async () => {
      const projectId = await createProjectFixture();
      const sourcePageId = await createPageFixture(projectId);
      const targetPageId = await createPageFixture(projectId);
      const created = await links.create({
        projectId,
        publicId: uniqueId("LINK"),
        sourcePageId,
        targetPageId,
      });
      const updated = await links.update(created.id, { anchor: "cas updated" }, "proposed");
      expect(updated?.anchor).toBe("cas updated");
    });

    it("update() with a CAS guard returns null (no write) when the expected status is stale", async () => {
      const projectId = await createProjectFixture();
      const sourcePageId = await createPageFixture(projectId);
      const targetPageId = await createPageFixture(projectId);
      const created = await links.create({
        projectId,
        publicId: uniqueId("LINK"),
        sourcePageId,
        targetPageId,
      });
      // The link is really `proposed`; claim we expected `approved` — a stale read.
      const result = await links.update(created.id, { anchor: "should not apply" }, "approved");
      expect(result).toBeNull();

      const stillOriginal = await links.findById(created.id);
      expect(stillOriginal?.anchor).toBeNull();
    });

    it("updateStatus() changes status when the expected current status matches", async () => {
      const projectId = await createProjectFixture();
      const sourcePageId = await createPageFixture(projectId);
      const targetPageId = await createPageFixture(projectId);
      const created = await links.create({
        projectId,
        publicId: uniqueId("LINK"),
        sourcePageId,
        targetPageId,
      });
      const result = await links.updateStatus(created.id, "proposed", "approved", null);
      expect(result.outcome).toBe("updated");
      expect(result.outcome === "updated" && result.entity.status).toBe("approved");
    });

    it("updateStatus() reports not_found for a missing link", async () => {
      const result = await links.updateStatus(
        "00000000-0000-4000-8000-000000000000",
        "proposed",
        "approved",
        null,
      );
      expect(result.outcome).toBe("not_found");
    });

    it("updateStatus() reports conflict (and does not write) on the atomic compare-and-swap", async () => {
      const projectId = await createProjectFixture();
      const sourcePageId = await createPageFixture(projectId);
      const targetPageId = await createPageFixture(projectId);
      const created = await links.create({
        projectId,
        publicId: uniqueId("LINK"),
        sourcePageId,
        targetPageId,
      });
      // The link is really `proposed`; claim we expected `approved` — a stale/incorrect read.
      const result = await links.updateStatus(created.id, "approved", "implemented", null);
      expect(result.outcome).toBe("conflict");
      expect(result.outcome === "conflict" && result.entity.status).toBe("proposed");

      const stillProposed = await links.findById(created.id);
      expect(stillProposed?.status).toBe("proposed");
    });

    it("rejects an invalid status at the database layer (real ENUM constraint)", async () => {
      const projectId = await createProjectFixture();
      const sourcePageId = await createPageFixture(projectId);
      const targetPageId = await createPageFixture(projectId);
      const created = await links.create({
        projectId,
        publicId: uniqueId("LINK"),
        sourcePageId,
        targetPageId,
      });
      await expect(
        // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
        links.updateStatus(created.id, "proposed", "not_a_real_status", null),
      ).rejects.toThrow();
    });

    it(
      "updateStatus() stamps implementedAt the first time a link reaches implemented, and does " +
        "NOT overwrite it on a later re-entry into implemented via the backward verified -> " +
        "implemented transition (task package D2's own 'stamp once, never overwrite' contract)",
      async () => {
        const projectId = await createProjectFixture();
        const sourcePageId = await createPageFixture(projectId);
        const targetPageId = await createPageFixture(projectId);
        const created = await links.create({
          projectId,
          publicId: uniqueId("LINK"),
          sourcePageId,
          targetPageId,
        });

        await links.updateStatus(created.id, "proposed", "approved", null);
        const firstImplement = await links.updateStatus(
          created.id,
          "approved",
          "implemented",
          null,
        );
        expect(firstImplement.outcome).toBe("updated");
        const firstImplementedAt =
          firstImplement.outcome === "updated" ? firstImplement.entity.implementedAt : null;
        expect(firstImplementedAt).not.toBeNull();

        // Advance to verified, then a small real delay, then back to implemented — a genuine
        // second entry into the `implemented` state.
        await links.updateStatus(created.id, "implemented", "verified", null);
        await new Promise((resolve) => setTimeout(resolve, 20));
        const secondImplement = await links.updateStatus(
          created.id,
          "verified",
          "implemented",
          null,
        );
        expect(secondImplement.outcome).toBe("updated");
        const secondImplementedAt =
          secondImplement.outcome === "updated" ? secondImplement.entity.implementedAt : null;

        // The COALESCE guard must have preserved the original timestamp, not overwritten it with
        // a later NOW().
        expect(secondImplementedAt).toBe(firstImplementedAt);
      },
    );

    it(
      "updateStatus() stamps verifiedAt the first time a link reaches verified, and does NOT " +
        "overwrite it on a later re-entry into verified",
      async () => {
        const projectId = await createProjectFixture();
        const sourcePageId = await createPageFixture(projectId);
        const targetPageId = await createPageFixture(projectId);
        const created = await links.create({
          projectId,
          publicId: uniqueId("LINK"),
          sourcePageId,
          targetPageId,
        });

        await links.updateStatus(created.id, "proposed", "approved", null);
        await links.updateStatus(created.id, "approved", "implemented", null);
        const firstVerify = await links.updateStatus(created.id, "implemented", "verified", null);
        expect(firstVerify.outcome).toBe("updated");
        const firstVerifiedAt =
          firstVerify.outcome === "updated" ? firstVerify.entity.verifiedAt : null;
        expect(firstVerifiedAt).not.toBeNull();

        await links.updateStatus(created.id, "verified", "implemented", null);
        await new Promise((resolve) => setTimeout(resolve, 20));
        const secondVerify = await links.updateStatus(
          created.id,
          "implemented",
          "verified",
          null,
        );
        expect(secondVerify.outcome).toBe("updated");
        const secondVerifiedAt =
          secondVerify.outcome === "updated" ? secondVerify.entity.verifiedAt : null;

        expect(secondVerifiedAt).toBe(firstVerifiedAt);
      },
    );

    it("updateStatus() leaves implementedAt/verifiedAt null when the transition doesn't reach either state", async () => {
      const projectId = await createProjectFixture();
      const sourcePageId = await createPageFixture(projectId);
      const targetPageId = await createPageFixture(projectId);
      const created = await links.create({
        projectId,
        publicId: uniqueId("LINK"),
        sourcePageId,
        targetPageId,
      });

      const result = await links.updateStatus(created.id, "proposed", "approved", null);
      expect(result.outcome).toBe("updated");
      if (result.outcome === "updated") {
        expect(result.entity.implementedAt).toBeNull();
        expect(result.entity.verifiedAt).toBeNull();
      }
    });
  });

  describe("Project-scoping RESTRICT behavior (task package rule 7 precedent)", () => {
    it("rejects deleting a project that still has internal links (RESTRICT, not CASCADE)", async () => {
      const projectId = await createProjectFixture();
      const sourcePageId = await createPageFixture(projectId);
      const targetPageId = await createPageFixture(projectId);
      await links.create({
        projectId,
        publicId: uniqueId("LINK"),
        sourcePageId,
        targetPageId,
      });

      const { getConnection } = await import("../src/connection.js");
      await expect(
        getConnection().query("DELETE FROM projects WHERE id = :id", {
          replacements: { id: projectId },
        }),
      ).rejects.toThrow();
    });

    it("rejects deleting a page that is still referenced as a link's source_page_id (RESTRICT, not CASCADE)", async () => {
      const projectId = await createProjectFixture();
      const sourcePageId = await createPageFixture(projectId);
      const targetPageId = await createPageFixture(projectId);
      await links.create({
        projectId,
        publicId: uniqueId("LINK"),
        sourcePageId,
        targetPageId,
      });

      const { getConnection } = await import("../src/connection.js");
      await expect(
        getConnection().query("DELETE FROM pages WHERE id = :id", {
          replacements: { id: sourcePageId },
        }),
      ).rejects.toThrow();
    });
  });
});
