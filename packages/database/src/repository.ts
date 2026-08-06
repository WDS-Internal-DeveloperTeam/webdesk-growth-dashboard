import type { BaseEntity, PaginatedResult, PaginationParams } from "@webdesk/shared-types";

/**
 * The shape every repository will implement once Phase 1B introduces real
 * Sequelize models. `dashboard-api` and `dashboard-worker` both depend on
 * repositories through this interface — never on Sequelize directly — so
 * the eventual Sequelize implementation is swappable and mockable in tests.
 * No implementation exists yet; this is the contract Phase 1B builds against.
 */
export interface Repository<TEntity extends BaseEntity> {
  findById(id: string): Promise<TEntity | null>;
  findMany(params: PaginationParams): Promise<PaginatedResult<TEntity>>;
  create(input: Omit<TEntity, "id" | "createdAt" | "updatedAt">): Promise<TEntity>;
  update(
    id: string,
    input: Partial<Omit<TEntity, "id" | "createdAt" | "updatedAt">>,
  ): Promise<TEntity>;
  /** Soft delete only — see docs/architecture/decisions/0016-operational-data-vs-git-artifact-ownership.md. */
  softDelete(id: string): Promise<void>;
}
