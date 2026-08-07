import type { BaseEntity } from "@webdesk/shared-types";
import { DataTypes, type Model, type ModelStatic } from "sequelize";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SequelizeRepository } from "../src/base-repository.js";
import { closeConnection, getConnection } from "../src/connection.js";
import { checkDatabaseHealth } from "../src/health.js";
import { buildMigrator } from "../src/migrate.js";
import { withTransaction } from "../src/transaction.js";

/**
 * Exercises the whole Phase 1B database foundation against a REAL,
 * disposable PostgreSQL database — never mocked, per
 * docs/contracts/database-contract.md's "Test requirements" and
 * docs/task-packages/phase-1b-database-foundation.md §18/§21. Requires
 * DATABASE_URL to point at a throwaway database before running (see
 * packages/database/README.md).
 *
 * Uses the `_framework_probe` table created by migration 00001 — proves
 * the framework end-to-end without touching any real business entity
 * (projects/users are out of scope, §9/§24).
 */

interface FrameworkProbeEntity extends BaseEntity {
  readonly label: string;
}

function defineFrameworkProbeModel(): ModelStatic<Model> {
  return getConnection().define(
    "FrameworkProbe",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      label: { type: DataTypes.STRING, allowNull: false },
    },
    { tableName: "_framework_probe", underscored: true, timestamps: true, paranoid: true },
  );
}

describe("Phase 1B database foundation (real disposable database)", () => {
  let model: ModelStatic<Model>;
  let repository: SequelizeRepository<FrameworkProbeEntity>;

  beforeAll(async () => {
    const migrator = buildMigrator();
    await migrator.up();
    model = defineFrameworkProbeModel();
    repository = new SequelizeRepository<FrameworkProbeEntity>(model);
  });

  afterAll(async () => {
    const migrator = buildMigrator();
    await migrator.down();
    await closeConnection();
  });

  describe("connection health", () => {
    it("reports ok against a live connection", async () => {
      const result = await checkDatabaseHealth();
      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("SequelizeRepository (Repository<TEntity>)", () => {
    it("creates and finds an entity by id", async () => {
      const created = await repository.create({ label: "probe-1" });
      expect(created.id).toBeTruthy();
      expect(created.label).toBe("probe-1");
      expect(typeof created.createdAt).toBe("string");
      expect(typeof created.updatedAt).toBe("string");

      const found = await repository.findById(created.id);
      expect(found?.id).toBe(created.id);
      expect(found?.label).toBe("probe-1");
    });

    it("returns null for an unknown id", async () => {
      const found = await repository.findById("00000000-0000-0000-0000-000000000000");
      expect(found).toBeNull();
    });

    it("updates an entity", async () => {
      const created = await repository.create({ label: "before" });
      const updated = await repository.update(created.id, { label: "after" });
      expect(updated.label).toBe("after");

      const reFetched = await repository.findById(created.id);
      expect(reFetched?.label).toBe("after");
    });

    it("paginates via findMany", async () => {
      await repository.create({ label: "page-a" });
      await repository.create({ label: "page-b" });

      const page1 = await repository.findMany({ page: 1, pageSize: 1 });
      expect(page1.items).toHaveLength(1);
      expect(page1.pageSize).toBe(1);
      expect(page1.totalItems).toBeGreaterThanOrEqual(2);
      expect(page1.totalPages).toBeGreaterThanOrEqual(2);
    });

    it("soft-deletes — the row is excluded from normal reads but not hard-deleted", async () => {
      const created = await repository.create({ label: "to-delete" });
      await repository.softDelete(created.id);

      const foundAfterDelete = await repository.findById(created.id);
      expect(foundAfterDelete).toBeNull();

      // Still physically present — paranoid mode set deletedAt, did not DELETE the row.
      const stillInDb = await model.findByPk(created.id, { paranoid: false });
      expect(stillInDb).not.toBeNull();
    });
  });

  describe("withTransaction (real commit/rollback)", () => {
    it("commits on success", async () => {
      const label = `tx-commit-${Date.now()}`;
      await withTransaction(async (transaction) => {
        await model.create({ label }, { transaction });
      });

      const rows = await model.findAll({ where: { label } });
      expect(rows).toHaveLength(1);
    });

    it("rolls back on a thrown error — the row must not exist afterward", async () => {
      const label = `tx-rollback-${Date.now()}`;
      await expect(
        withTransaction(async (transaction) => {
          await model.create({ label }, { transaction });
          throw new Error("intentional failure to trigger rollback");
        }),
      ).rejects.toThrow("intentional failure to trigger rollback");

      const rows = await model.findAll({ where: { label } });
      expect(rows).toHaveLength(0);
    });
  });
});
