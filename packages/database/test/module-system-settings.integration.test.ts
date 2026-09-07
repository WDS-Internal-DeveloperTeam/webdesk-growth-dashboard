import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SystemSettingRepository } from "../src/system-settings/index.js";
import { closeConnection } from "../src/connection.js";
import { buildMigrator } from "../src/migrate.js";

/**
 * Exercises the System Settings schema (migration `00120`) against a REAL, disposable PostgreSQL
 * database. Mirrors ../test/module-brand-library.integration.test.ts's own structure, including
 * dedicated coverage for the one atomic compare-and-swap method (`updateActiveState()`) under
 * genuinely concurrent writes.
 */
describe("System Settings module (real disposable database)", () => {
  const settings = new SystemSettingRepository();

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

  describe("SystemSettingRepository", () => {
    it("creates a system setting defaulting to active", async () => {
      const created = await settings.create({
        publicId: uniqueId("SETTING"),
        settingType: "git_rule",
        key: uniqueId("branch-pattern"),
        value: { pattern: "^(feature|fix)/[a-z0-9-]+$" },
      });
      expect(created.isActive).toBe(true);
      expect(created.description).toBeNull();
    });

    it("round-trips value (JSONB) and description", async () => {
      const created = await settings.create({
        publicId: uniqueId("SETTING"),
        settingType: "file_limit",
        key: uniqueId("max-upload-bytes"),
        value: { maxBytes: 10_485_760, allowedMimeTypes: ["application/pdf", "image/png"] },
        description: "Maximum upload size for attachments",
      });
      const found = await settings.findById(created.id);
      expect(found?.value).toEqual({
        maxBytes: 10_485_760,
        allowedMimeTypes: ["application/pdf", "image/png"],
      });
      expect(found?.description).toBe("Maximum upload size for attachments");
    });

    it("rejects an invalid settingType at the database layer (real ENUM constraint)", async () => {
      await expect(
        settings.create({
          publicId: uniqueId("SETTING"),
          // @ts-expect-error deliberately invalid to prove the DB-level ENUM constraint
          settingType: "not_a_real_type",
          key: uniqueId("x"),
          value: {},
        }),
      ).rejects.toThrow();
    });

    it("rejects a duplicate publicId at the database layer", async () => {
      const publicId = uniqueId("SETTING");
      await settings.create({
        publicId,
        settingType: "git_rule",
        key: uniqueId("first"),
        value: {},
      });
      await expect(
        settings.create({
          publicId,
          settingType: "git_rule",
          key: uniqueId("second"),
          value: {},
        }),
      ).rejects.toThrow();
    });

    it("rejects a duplicate (settingType, key) pair at the database layer", async () => {
      const key = uniqueId("duplicate-key");
      await settings.create({
        publicId: uniqueId("SETTING"),
        settingType: "git_rule",
        key,
        value: {},
      });
      await expect(
        settings.create({
          publicId: uniqueId("SETTING"),
          settingType: "git_rule",
          key,
          value: {},
        }),
      ).rejects.toThrow();
    });

    it("allows the identical key across two different settingTypes (D3 — scoped uniqueness, not global)", async () => {
      const key = uniqueId("branch-pattern");
      const gitRule = await settings.create({
        publicId: uniqueId("SETTING"),
        settingType: "git_rule",
        key,
        value: {},
      });
      const docRule = await settings.create({
        publicId: uniqueId("SETTING"),
        settingType: "documentation_rule",
        key,
        value: {},
      });
      expect(gitRule.key).toBe(docRule.key);
      expect(gitRule.settingType).not.toBe(docRule.settingType);
    });

    it("findByTypeAndKey finds the real row and returns null for a missing one", async () => {
      const key = uniqueId("lookup-key");
      const created = await settings.create({
        publicId: uniqueId("SETTING"),
        settingType: "environment",
        key,
        value: { name: "staging", url: "https://staging.example.com" },
      });
      expect((await settings.findByTypeAndKey("environment", key))?.id).toBe(created.id);
      expect(await settings.findByTypeAndKey("environment", "does-not-exist")).toBeNull();
    });

    it("findById returns null for a missing system setting", async () => {
      expect(await settings.findById("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("list() filters by settingType, isActive, and search (case-insensitive, over key and description)", async () => {
      const uniqueKey = uniqueId("unique-searchable-key");
      await settings.create({
        publicId: uniqueId("SETTING"),
        settingType: "escalation_sla",
        key: uniqueKey,
        value: {},
      });

      const byType = await settings.list({ settingType: "escalation_sla" });
      expect(byType.length).toBeGreaterThanOrEqual(1);

      const byActive = await settings.list({ isActive: true });
      expect(byActive.length).toBeGreaterThanOrEqual(1);

      const bySearch = await settings.list({ search: uniqueKey.toLowerCase() });
      expect(bySearch.length).toBe(1);
    });

    it("list() search also matches description, not just key", async () => {
      const uniqueDescription = uniqueId("Unique Searchable Description");
      const created = await settings.create({
        publicId: uniqueId("SETTING"),
        settingType: "backup_rule",
        key: uniqueId("backup-key"),
        value: {},
        description: uniqueDescription,
      });

      const bySearch = await settings.list({ search: uniqueDescription });
      expect(bySearch.map((s) => s.id)).toContain(created.id);
    });

    it("list() search treats a literal % as literal text, not a SQL wildcard (escapeLikePattern)", async () => {
      const uniqueSuffix = uniqueId("PCT");
      const wildcardMatch = await settings.create({
        publicId: uniqueId("SETTING"),
        settingType: "git_rule",
        key: `50% off ${uniqueSuffix}`,
        value: {},
      });
      const plainMatch = await settings.create({
        publicId: uniqueId("SETTING"),
        settingType: "git_rule",
        key: `50X off ${uniqueSuffix}`,
        value: {},
      });

      const result = await settings.list({ search: `50% off ${uniqueSuffix}` });
      const ids = result.map((s) => s.id);
      expect(ids).toContain(wildcardMatch.id);
      expect(ids).not.toContain(plainMatch.id);
    });

    it("list() clamps an oversized limit to MAX_LIST_LIMIT (200)", async () => {
      const result = await settings.list({ limit: 100_000 });
      expect(result.length).toBeLessThanOrEqual(200);
    });

    it("update() changes content fields and never touches isActive/settingType", async () => {
      const created = await settings.create({
        publicId: uniqueId("SETTING"),
        settingType: "taxonomy_definition",
        key: uniqueId("original-key"),
        value: { levels: ["a", "b"] },
      });

      const updated = await settings.update(created.id, {
        value: { levels: ["a", "b", "c"] },
      });
      expect(updated?.value).toEqual({ levels: ["a", "b", "c"] });
      expect(updated?.settingType).toBe("taxonomy_definition");
      expect(updated?.isActive).toBe(true);
    });

    it("update() can rename key, and a later create() with the freed-up key succeeds", async () => {
      const originalKey = uniqueId("rename-me");
      const created = await settings.create({
        publicId: uniqueId("SETTING"),
        settingType: "git_rule",
        key: originalKey,
        value: {},
      });

      const newKey = uniqueId("renamed");
      const updated = await settings.update(created.id, { key: newKey });
      expect(updated?.key).toBe(newKey);

      const reused = await settings.create({
        publicId: uniqueId("SETTING"),
        settingType: "git_rule",
        key: originalKey,
        value: {},
      });
      expect(reused.key).toBe(originalKey);
    });

    it("update() rejects renaming a key onto an already-in-use (settingType, key) pair at the database layer", async () => {
      const takenKey = uniqueId("already-taken");
      await settings.create({
        publicId: uniqueId("SETTING"),
        settingType: "git_rule",
        key: takenKey,
        value: {},
      });
      const other = await settings.create({
        publicId: uniqueId("SETTING"),
        settingType: "git_rule",
        key: uniqueId("other-key"),
        value: {},
      });

      await expect(settings.update(other.id, { key: takenKey })).rejects.toThrow();
    });

    it("update() returns null for a missing system setting", async () => {
      expect(
        await settings.update("00000000-0000-4000-8000-000000000000", { key: "x" }),
      ).toBeNull();
    });

    it("update() stores an explicit null on the nullable description field directly", async () => {
      const created = await settings.create({
        publicId: uniqueId("SETTING"),
        settingType: "git_rule",
        key: uniqueId("clear-description"),
        value: {},
        description: "Some description",
      });

      const updated = await settings.update(created.id, { description: null });
      expect(updated?.description).toBeNull();
    });

    describe("updateActiveState() — atomic compare-and-swap", () => {
      it("deactivates (true -> false) when no expectedIsActive is passed (unconditional toggle)", async () => {
        const created = await settings.create({
          publicId: uniqueId("SETTING"),
          settingType: "git_rule",
          key: uniqueId("toggle-key"),
          value: {},
        });
        const result = await settings.updateActiveState(created.id, false, null);
        expect(result.outcome).toBe("updated");
        expect(result.outcome === "updated" && result.entity.isActive).toBe(false);
      });

      it("reports not_found for a missing system setting", async () => {
        const result = await settings.updateActiveState(
          "00000000-0000-4000-8000-000000000000",
          false,
          null,
        );
        expect(result.outcome).toBe("not_found");
      });

      it("with an expectedIsActive guard, reports conflict (and does not write) on a stale read", async () => {
        const created = await settings.create({
          publicId: uniqueId("SETTING"),
          settingType: "git_rule",
          key: uniqueId("cas-conflict-key"),
          value: {},
        });
        // The row is really active (true); claim we expected it to already be inactive (false) —
        // a stale read.
        const result = await settings.updateActiveState(created.id, true, null, false);
        expect(result.outcome).toBe("conflict");
        expect(result.outcome === "conflict" && result.entity.isActive).toBe(true);

        const stillActive = await settings.findById(created.id);
        expect(stillActive?.isActive).toBe(true);
      });

      it("with a matching expectedIsActive guard, succeeds normally", async () => {
        const created = await settings.create({
          publicId: uniqueId("SETTING"),
          settingType: "git_rule",
          key: uniqueId("cas-match-key"),
          value: {},
        });
        const result = await settings.updateActiveState(created.id, false, null, true);
        expect(result.outcome).toBe("updated");
        expect(result.outcome === "updated" && result.entity.isActive).toBe(false);
      });

      it("under a genuine concurrent race (two simultaneous CAS calls with the same expected state), only one wins", async () => {
        const created = await settings.create({
          publicId: uniqueId("SETTING"),
          settingType: "git_rule",
          key: uniqueId("real-race-key"),
          value: {},
        });

        const [first, second] = await Promise.all([
          settings.updateActiveState(created.id, false, null, true),
          settings.updateActiveState(created.id, false, null, true),
        ]);

        const outcomes = [first.outcome, second.outcome].sort();
        expect(outcomes).toEqual(["conflict", "updated"]);

        const final = await settings.findById(created.id);
        expect(final?.isActive).toBe(false);
      });
    });
  });
});
