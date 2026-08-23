import { Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getKeywordAndEntityLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { EntityRecordEntity } from "./entities.js";

type EntityRecordContentFields = Omit<EntityRecordEntity, "id" | "createdAt" | "updatedAt">;
type EntityRecordUpdateFields = Omit<EntityRecordContentFields, "publicId" | "projectId">;

export interface EntityRecordListFilter {
  /** Required — entities are project-scoped (task package D2). */
  readonly projectId: string;
  readonly entityType?: string;
  /** Fuzzy match on `name` (uses the `pg_trgm` index). */
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** No approval workflow of its own (task package D3) — plain CRUD, no `updateStatus()`. */
export class EntityRepository {
  private readonly model = getKeywordAndEntityLibraryModels().EntityRecord;

  async create(
    input: Partial<EntityRecordContentFields> &
      Pick<EntityRecordContentFields, "projectId" | "publicId" | "name">,
  ): Promise<EntityRecordEntity> {
    const instance = await this.model.create({
      projectId: input.projectId,
      publicId: input.publicId,
      name: input.name,
      entityType: input.entityType ?? null,
      description: input.description ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<EntityRecordEntity>(instance);
  }

  async findById(id: string): Promise<EntityRecordEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<EntityRecordEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<EntityRecordEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<EntityRecordEntity>(instance) : null;
  }

  /** Batch existence check, scoped to a project — for the relationship-creation cross-entity
   *  validation in `KeywordEntityRelationshipsService.create()`. Mirrors `ServiceRepository.findByIds()`'s
   *  own precedent (`packages/database/src/service-library/service.repository.ts`). */
  async findByIds(
    ids: readonly string[],
    projectId: string,
  ): Promise<readonly EntityRecordEntity[]> {
    if (ids.length === 0) {
      return [];
    }
    const rows = await this.model.findAll({ where: { id: ids, projectId } });
    return rows.map((row) => toEntityWithIsoDates<EntityRecordEntity>(row));
  }

  async list(filter: EntityRecordListFilter): Promise<readonly EntityRecordEntity[]> {
    const where: Record<string, unknown> = { projectId: filter.projectId };
    if (filter.entityType) {
      where.entityType = filter.entityType;
    }
    if (filter.search) {
      where.name = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
    }

    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<EntityRecordEntity>(row));
  }

  /** A single atomic `UPDATE ... RETURNING`, not a separate `findOne()` + `instance.update()` —
   *  mirrors `PageRepository.update()`'s own already-atomic shape. No CAS guard needed — entities
   *  have no approval workflow (task package D3). */
  async update(
    id: string,
    patch: Partial<EntityRecordUpdateFields>,
  ): Promise<EntityRecordEntity | null> {
    const [affectedCount, affectedRows] = await this.model.update(patch, {
      where: { id },
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<EntityRecordEntity>(affectedRows[0]);
  }

  /** `projectId`-scoped (IDOR prevention), mirroring `PageUrlRepository.remove()`'s own identical
   *  discipline for a sub-resource-shaped delete. Hard delete is fine here — entities are
   *  lightweight reference records, not audited artifacts (task package D3); any dependent
   *  `keyword_entity_relationships` rows are removed via `ON DELETE CASCADE` (migration `00060`). */
  async remove(id: string, projectId: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id, projectId } });
    return count > 0;
  }
}
