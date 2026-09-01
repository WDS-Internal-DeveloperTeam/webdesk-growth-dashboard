import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ReadyForClaudeTaskRepository } from "../src/ready-for-claude-queue/index.js";
import { ProjectRepository } from "../src/projects/index.js";
import { closeConnection, getConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the Ready for Claude Queue schema (migration `00101`) against a REAL, disposable
 * PostgreSQL database. Mirrors `module-internal-linking-library.integration.test.ts`'s own
 * structure, plus real coverage for the two mechanisms this module's own repository introduces:
 * the `uuid[]` `dependencies` array column (D2) and the compare-and-swap guards on both
 * `update()` and `updateStatus()`.
 */
describe("Ready for Claude Queue module (real disposable database)", () => {
  const tasks = new ReadyForClaudeTaskRepository();
  const projects = new ProjectRepository();

  let counter = 0;
  function uniqueId(prefix: string): string {
    counter += 1;
    return `${prefix}-${Date.now()}-${counter}`;
  }

  async function createTaskFixture(
    overrides: Record<string, unknown> = {},
  ): Promise<Awaited<ReturnType<ReadyForClaudeTaskRepository["create"]>>> {
    return tasks.create({
      publicId: uniqueId("RFC"),
      title: "Fixture task",
      ...overrides,
    });
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

  describe("schema", () => {
    it("applies migration 00101 and 00102, leaving the module registry in_development", async () => {
      const [rows] = await getConnection().query(
        "SELECT implementation_status FROM module_registry WHERE key = 'ready_for_claude_queue';",
      );
      expect((rows as Array<{ implementation_status: string }>)[0]?.implementation_status).toBe(
        "in_development",
      );
    });

    it("creates every declared index, including the pg_trgm GIN index on title", async () => {
      const [rows] = await getConnection().query(
        "SELECT indexname FROM pg_indexes WHERE tablename = 'ready_for_claude_tasks';",
      );
      const names = (rows as Array<{ indexname: string }>).map((row) => row.indexname);
      expect(names).toContain("ready_for_claude_tasks_public_id_unique");
      expect(names).toContain("ready_for_claude_tasks_status_updated_at_id_idx");
      expect(names).toContain("ready_for_claude_tasks_project_id_idx");
      expect(names).toContain("ready_for_claude_tasks_target_module_key_target_id_idx");
      expect(names).toContain("ready_for_claude_tasks_title_trgm_idx");
    });

    it("stores dependencies as a real uuid[] column, not text[]", async () => {
      const [rows] = await getConnection().query(
        `SELECT udt_name FROM information_schema.columns
         WHERE table_name = 'ready_for_claude_tasks' AND column_name = 'dependencies';`,
      );
      // Postgres reports an array type as `_<element type>`.
      expect((rows as Array<{ udt_name: string }>)[0]?.udt_name).toBe("_uuid");
    });
  });

  describe("ReadyForClaudeTaskRepository", () => {
    it("creates a task defaulting to draft/medium/empty dependencies/retryCount 0", async () => {
      const created = await createTaskFixture();
      expect(created.status).toBe("draft");
      expect(created.priority).toBe("medium");
      expect(created.dependencies).toEqual([]);
      expect(created.retryCount).toBe(0);
      expect(created.productionApproval).toBe(false);
      expect(created.projectId).toBeNull();
      expect(created.dueDate).toBeNull();
    });

    it("rejects a duplicate publicId at the database layer (global uniqueness)", async () => {
      const publicId = uniqueId("RFC");
      await tasks.create({ publicId, title: "First" });
      await expect(tasks.create({ publicId, title: "Second" })).rejects.toThrow();
    });

    it("rejects a task row with no title at the database layer (real NOT NULL column)", async () => {
      await expect(
        // @ts-expect-error deliberately omitted to prove the DB-level NOT NULL constraint
        tasks.create({ publicId: uniqueId("RFC") }),
      ).rejects.toThrow();
    });

    it("persists an optional project_id through the real FK (D5)", async () => {
      const project = await projects.create({
        publicId: uniqueId("PROJ"),
        name: "Ready for Claude Queue Fixture Project",
      });
      const created = await createTaskFixture({ projectId: project.id });
      expect(created.projectId).toBe(project.id);
    });

    it("rejects a project_id that does not exist (real FK constraint)", async () => {
      await expect(
        createTaskFixture({ projectId: "00000000-0000-4000-8000-000000000000" }),
      ).rejects.toThrow();
    });

    it("round-trips a real dependencies array of other task ids (D2)", async () => {
      const first = await createTaskFixture();
      const second = await createTaskFixture();
      const dependent = await createTaskFixture({ dependencies: [first.id, second.id] });
      expect(dependent.dependencies).toEqual([first.id, second.id]);

      const reread = await tasks.findById(dependent.id);
      expect(reread?.dependencies).toEqual([first.id, second.id]);
    });

    it("rejects a non-uuid dependencies element at the database layer (uuid[] column)", async () => {
      await expect(
        createTaskFixture({ dependencies: ["not-a-uuid"] as unknown as readonly string[] }),
      ).rejects.toThrow();
    });

    it("existsById reports presence without returning the row", async () => {
      const created = await createTaskFixture();
      expect(await tasks.existsById(created.id)).toBe(true);
      expect(await tasks.existsById("00000000-0000-4000-8000-000000000000")).toBe(false);
    });

    it("existingIds resolves a mixed real/nonexistent id array in one batched query (code-review fix)", async () => {
      const first = await createTaskFixture();
      const second = await createTaskFixture();
      const missing = "00000000-0000-4000-8000-000000000000";
      const found = await tasks.existingIds([first.id, second.id, missing]);
      expect(found.has(first.id)).toBe(true);
      expect(found.has(second.id)).toBe(true);
      expect(found.has(missing)).toBe(false);
      expect(found.size).toBe(2);
    });

    it("existingIds returns an empty set for an empty input array without querying", async () => {
      const found = await tasks.existingIds([]);
      expect(found.size).toBe(0);
    });

    it("finds a task by its publicId", async () => {
      const publicId = uniqueId("RFC");
      await tasks.create({ publicId, title: "Findable" });
      const found = await tasks.findByPublicId(publicId);
      expect(found?.publicId).toBe(publicId);
      expect(await tasks.findByPublicId("no-such-public-id")).toBeNull();
    });

    it("converts dueDate to an ISO string, and leaves a null one null", async () => {
      const withDate = await createTaskFixture({ dueDate: "2026-12-01T10:00:00.000Z" });
      expect(withDate.dueDate).toBe("2026-12-01T10:00:00.000Z");
      const withoutDate = await createTaskFixture();
      expect(withoutDate.dueDate).toBeNull();
    });
  });

  describe("list", () => {
    it("filters by status, priority, projectId, targetModuleKey and agent", async () => {
      const project = await projects.create({
        publicId: uniqueId("PROJ"),
        name: "List Filter Fixture Project",
      });
      const marker = uniqueId("agent");
      await createTaskFixture({
        projectId: project.id,
        priority: "critical",
        agent: marker,
        targetModuleKey: "page_inventory",
      });
      await createTaskFixture({ priority: "low", agent: marker });

      expect(await tasks.list({ agent: marker })).toHaveLength(2);
      expect(await tasks.list({ agent: marker, priority: "critical" })).toHaveLength(1);
      expect(await tasks.list({ agent: marker, projectId: project.id })).toHaveLength(1);
      expect(await tasks.list({ agent: marker, targetModuleKey: "page_inventory" })).toHaveLength(
        1,
      );
      expect(await tasks.list({ agent: marker, status: "draft" })).toHaveLength(2);
      expect(await tasks.list({ agent: marker, status: "completed" })).toHaveLength(0);
    });

    it("fuzzy-matches title via the pg_trgm-backed ILIKE search", async () => {
      const marker = uniqueId("agent");
      const distinctive = `Zephyrine-${Date.now()}`;
      await createTaskFixture({ title: `Rebuild the ${distinctive} pipeline`, agent: marker });
      await createTaskFixture({ title: "Something else entirely", agent: marker });

      const hits = await tasks.list({ agent: marker, search: distinctive });
      expect(hits).toHaveLength(1);
      expect(hits[0]?.title).toContain(distinctive);
    });

    it("treats a LIKE wildcard in the search term as a literal, not a pattern", async () => {
      const marker = uniqueId("agent");
      await createTaskFixture({ title: "A literal 100% coverage task", agent: marker });
      await createTaskFixture({ title: "An unrelated task", agent: marker });

      expect(await tasks.list({ agent: marker, search: "100%" })).toHaveLength(1);
      // A bare `%` matches ONLY the row whose title genuinely contains a literal `%` — if it were
      // interpreted as a LIKE wildcard it would match both fixtures instead.
      expect(await tasks.list({ agent: marker, search: "%" })).toHaveLength(1);
      // An underscore is the other LIKE metacharacter: "An unrelated" has no literal `_`, so a
      // wildcard interpretation (matching any single character) would return both rows.
      expect(await tasks.list({ agent: marker, search: "_" })).toHaveLength(0);
    });

    it("clamps limit to MAX_LIST_LIMIT and honours offset", async () => {
      const marker = uniqueId("agent");
      await createTaskFixture({ agent: marker });
      await createTaskFixture({ agent: marker });
      await createTaskFixture({ agent: marker });

      expect(await tasks.list({ agent: marker, limit: 2 })).toHaveLength(2);
      expect(await tasks.list({ agent: marker, offset: 2 })).toHaveLength(1);
      expect(await tasks.list({ agent: marker, limit: 10_000 })).toHaveLength(3);
    });
  });

  describe("update — CAS guard", () => {
    it("applies a patch when the expected status still matches", async () => {
      const created = await createTaskFixture();
      const updated = await tasks.update(created.id, { title: "Renamed" }, "draft");
      expect(updated?.title).toBe("Renamed");
    });

    it("returns null (no write) when the expected status no longer matches", async () => {
      const created = await createTaskFixture();
      await tasks.updateStatus(created.id, "draft", "cancelled", null);

      const updated = await tasks.update(created.id, { title: "Renamed" }, "draft");
      expect(updated).toBeNull();

      const reread = await tasks.findById(created.id);
      expect(reread?.title).toBe("Fixture task");
      expect(reread?.status).toBe("cancelled");
    });

    it("never lets a content update change status (status is not an update field)", async () => {
      const created = await createTaskFixture();
      await tasks.update(
        created.id,
        { status: "completed" } as unknown as { title?: string },
        "draft",
      );
      const reread = await tasks.findById(created.id);
      expect(reread?.status).toBe("draft");
    });
  });

  describe("updateStatus — atomic compare-and-swap", () => {
    it("transitions and stamps updatedBy when the expected status matches", async () => {
      const created = await createTaskFixture();
      const result = await tasks.updateStatus(created.id, "draft", "ready_for_claude", null);
      expect(result.outcome).toBe("updated");
      if (result.outcome === "updated") {
        expect(result.entity.status).toBe("ready_for_claude");
      }
    });

    it("reports a conflict (not a silent success) when the expected status is stale", async () => {
      const created = await createTaskFixture();
      await tasks.updateStatus(created.id, "draft", "cancelled", null);

      const result = await tasks.updateStatus(created.id, "draft", "ready_for_claude", null);
      expect(result.outcome).toBe("conflict");
      if (result.outcome === "conflict") {
        expect(result.entity.status).toBe("cancelled");
      }
    });

    it("reports not_found for an id that does not exist", async () => {
      const result = await tasks.updateStatus(
        "00000000-0000-4000-8000-000000000000",
        "draft",
        "cancelled",
        null,
      );
      expect(result.outcome).toBe("not_found");
    });

    it("lets only one of two concurrent transitions win", async () => {
      const created = await createTaskFixture();
      const [first, second] = await Promise.all([
        tasks.updateStatus(created.id, "draft", "ready_for_claude", null),
        tasks.updateStatus(created.id, "draft", "cancelled", null),
      ]);
      const outcomes = [first.outcome, second.outcome].sort();
      expect(outcomes).toEqual(["conflict", "updated"]);
    });

    it("stamps productionApproval atomically when the transition lands on completed (code-review fix)", async () => {
      // `updatedBy`/the stamped approver both use `null` here, matching every other
      // `updateStatus()` test in this file — `production_approver_user_id` is a real FK into
      // `users`, and no user fixture exists in this suite to satisfy it with a non-null id.
      const created = await createTaskFixture();
      expect(created.productionApproval).toBe(false);
      expect(created.productionApproverUserId).toBeNull();

      const result = await tasks.updateStatus(created.id, "draft", "completed", null);

      expect(result.outcome).toBe("updated");
      if (result.outcome === "updated") {
        expect(result.entity.productionApproval).toBe(true);
        expect(result.entity.productionApproverUserId).toBeNull();
      }
    });

    it("never stamps productionApproval for a transition that does not land on completed", async () => {
      const created = await createTaskFixture();
      const result = await tasks.updateStatus(created.id, "draft", "ready_for_claude", null);
      expect(result.outcome).toBe("updated");
      if (result.outcome === "updated") {
        expect(result.entity.productionApproval).toBe(false);
        expect(result.entity.productionApproverUserId).toBeNull();
      }
    });
  });
});
