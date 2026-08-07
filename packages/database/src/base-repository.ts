import type { BaseEntity, PaginatedResult, PaginationParams } from "@webdesk/shared-types";
import type { Model, ModelStatic } from "sequelize";
import type { Repository } from "./repository.js";

/**
 * Sequelize-backed implementation of `Repository<TEntity>` (./repository.ts,
 * Phase 1A). Generic over any model whose table follows the base-entity
 * standard (id, createdAt, updatedAt, paranoid soft-delete) — every future
 * entity's own repository is a thin instantiation of this class, not a
 * reimplementation. No business entity is defined in this package yet
 * (docs/task-packages/phase-1b-database-foundation.md §9/§24); this class
 * is proven in tests against a minimal test-only model.
 */
export class SequelizeRepository<TEntity extends BaseEntity> implements Repository<TEntity> {
  constructor(private readonly model: ModelStatic<Model>) {}

  async findById(id: string): Promise<TEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? this.toEntity(instance) : null;
  }

  async findMany(params: PaginationParams): Promise<PaginatedResult<TEntity>> {
    const { page, pageSize } = params;
    const { rows, count } = await this.model.findAndCountAll({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      order: [["createdAt", "DESC"]],
    });
    return {
      items: rows.map((row) => this.toEntity(row)),
      page,
      pageSize,
      totalItems: count,
      totalPages: Math.ceil(count / pageSize),
    };
  }

  async create(input: Omit<TEntity, "id" | "createdAt" | "updatedAt">): Promise<TEntity> {
    const instance = await this.model.create(input as Record<string, unknown>);
    return this.toEntity(instance);
  }

  async update(
    id: string,
    input: Partial<Omit<TEntity, "id" | "createdAt" | "updatedAt">>,
  ): Promise<TEntity> {
    const instance = await this.model.findByPk(id);
    if (!instance) {
      throw new Error(`Entity not found: ${id}`);
    }
    await instance.update(input as Record<string, unknown>);
    return this.toEntity(instance);
  }

  /** Soft delete only, via Sequelize's `paranoid` mode — never a hard DELETE (ADR-0016). */
  async softDelete(id: string): Promise<void> {
    const instance = await this.model.findByPk(id);
    if (!instance) {
      throw new Error(`Entity not found: ${id}`);
    }
    await instance.destroy();
  }

  private toEntity(instance: Model): TEntity {
    const json = instance.toJSON() as Record<string, unknown>;
    return {
      ...json,
      createdAt: toIsoString(json.createdAt),
      updatedAt: toIsoString(json.updatedAt),
    } as TEntity;
  }
}

function toIsoString(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}
