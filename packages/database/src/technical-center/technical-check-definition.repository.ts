import { Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getTechnicalCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { TechnicalCheckDefinitionEntity, TechnicalCheckType } from "./entities.js";

type TechnicalCheckDefinitionContentFields = Omit<
  TechnicalCheckDefinitionEntity,
  "id" | "createdAt" | "updatedAt"
>;

/** `update()`'s patch shape — `projectId`/`publicId`/`checkType` are all excluded, all three
 *  immutable after create, mirroring `ScanDefinitionUpdateFields`'s own precedent. `checkType`
 *  exclusion is enforced HERE at the type level, not just by `updateTechnicalCheckDefinitionSchema`
 *  omitting it. */
type TechnicalCheckDefinitionUpdateFields = Omit<
  TechnicalCheckDefinitionContentFields,
  "projectId" | "publicId" | "checkType"
>;

export interface TechnicalCheckDefinitionListFilter {
  readonly projectId: string;
  readonly checkType?: TechnicalCheckType;
  readonly isEnabled?: boolean;
  /** Fuzzy match on `name`. */
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export class TechnicalCheckDefinitionRepository {
  private readonly model = getTechnicalCenterModels().TechnicalCheckDefinition;

  async create(
    input: Partial<TechnicalCheckDefinitionContentFields> &
      Pick<TechnicalCheckDefinitionContentFields, "projectId" | "publicId" | "name" | "checkType">,
  ): Promise<TechnicalCheckDefinitionEntity> {
    const instance = await this.model.create({
      projectId: input.projectId,
      publicId: input.publicId,
      name: input.name,
      checkType: input.checkType,
      mode: input.mode ?? "manual",
      target: input.target ?? null,
      environment: input.environment ?? null,
      scheduleCron: input.scheduleCron ?? null,
      isEnabled: input.isEnabled ?? true,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<TechnicalCheckDefinitionEntity>(instance);
  }

  async findById(id: string): Promise<TechnicalCheckDefinitionEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<TechnicalCheckDefinitionEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<TechnicalCheckDefinitionEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<TechnicalCheckDefinitionEntity>(instance) : null;
  }

  async list(
    filter: TechnicalCheckDefinitionListFilter,
  ): Promise<readonly TechnicalCheckDefinitionEntity[]> {
    const where: Record<string, unknown> = { projectId: filter.projectId };
    if (filter.checkType) {
      where.checkType = filter.checkType;
    }
    if (filter.isEnabled !== undefined) {
      where.isEnabled = filter.isEnabled;
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
    return rows.map((row) => toEntityWithIsoDates<TechnicalCheckDefinitionEntity>(row));
  }

  /** A plain, atomic `UPDATE ... RETURNING` — no CAS guard needed, a definition has no workflow of
   *  its own to race against. */
  async update(
    id: string,
    patch: Partial<TechnicalCheckDefinitionUpdateFields>,
  ): Promise<TechnicalCheckDefinitionEntity | null> {
    const [affectedCount, affectedRows] = await this.model.update(patch, {
      where: { id },
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<TechnicalCheckDefinitionEntity>(affectedRows[0]);
  }
}
