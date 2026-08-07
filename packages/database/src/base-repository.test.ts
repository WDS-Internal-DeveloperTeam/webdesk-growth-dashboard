import type { BaseEntity } from "@webdesk/shared-types";
import type { Model, ModelStatic } from "sequelize";
import { describe, expect, it, vi } from "vitest";
import { SequelizeRepository } from "./base-repository.js";

interface FakeEntity extends BaseEntity {
  readonly label: string;
}

function fakeInstance(data: Record<string, unknown>): Model {
  return {
    toJSON: () => data,
    update: vi.fn(async (input: Record<string, unknown>) => Object.assign(data, input)),
    destroy: vi.fn(async () => {
      data.deletedAt = new Date();
    }),
  } as unknown as Model;
}

/**
 * Mocked-model unit tests — fast feedback on `SequelizeRepository`'s own
 * translation logic (Date -> ISO string, pagination math). Real Sequelize
 * behavior (actual soft-delete filtering, actual SQL) is proven against a
 * live disposable database by test/database-foundation.integration.test.ts,
 * per docs/task-packages/phase-1b-database-foundation.md §18/§21.
 */
describe("SequelizeRepository", () => {
  it("findById converts Date timestamps to ISO strings", async () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const instance = fakeInstance({ id: "1", label: "a", createdAt: now, updatedAt: now });
    const model = {
      findByPk: vi.fn().mockResolvedValue(instance),
    } as unknown as ModelStatic<Model>;

    const repository = new SequelizeRepository<FakeEntity>(model);
    const found = await repository.findById("1");

    expect(found?.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(found?.updatedAt).toBe("2026-01-01T00:00:00.000Z");
  });

  it("findById returns null when the model finds nothing", async () => {
    const model = { findByPk: vi.fn().mockResolvedValue(null) } as unknown as ModelStatic<Model>;
    const repository = new SequelizeRepository<FakeEntity>(model);

    expect(await repository.findById("missing")).toBeNull();
  });

  it("findMany computes pagination metadata from the count", async () => {
    const now = new Date();
    const rows = [fakeInstance({ id: "1", label: "a", createdAt: now, updatedAt: now })];
    const model = {
      findAndCountAll: vi.fn().mockResolvedValue({ rows, count: 21 }),
    } as unknown as ModelStatic<Model>;

    const repository = new SequelizeRepository<FakeEntity>(model);
    const page = await repository.findMany({ page: 2, pageSize: 10 });

    expect(model.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 10, offset: 10 }),
    );
    expect(page.totalItems).toBe(21);
    expect(page.totalPages).toBe(3);
  });

  it("update throws a clear error for an unknown id", async () => {
    const model = { findByPk: vi.fn().mockResolvedValue(null) } as unknown as ModelStatic<Model>;
    const repository = new SequelizeRepository<FakeEntity>(model);

    await expect(repository.update("missing", { label: "x" })).rejects.toThrow(/not found/);
  });

  it("softDelete throws a clear error for an unknown id", async () => {
    const model = { findByPk: vi.fn().mockResolvedValue(null) } as unknown as ModelStatic<Model>;
    const repository = new SequelizeRepository<FakeEntity>(model);

    await expect(repository.softDelete("missing")).rejects.toThrow(/not found/);
  });
});
