import { Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getScanCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ScanDefinitionEntity, ScanType } from "./entities.js";

type ScanDefinitionContentFields = Omit<ScanDefinitionEntity, "id" | "createdAt" | "updatedAt">;

/** `update()`'s patch shape — `projectId`/`publicId`/`scanType` are all excluded, all three
 *  immutable after create (mirrors `InternalLinkUpdateFields`'s own precedent). `scanType`
 *  exclusion is enforced HERE at the type level, not just by `updateScanDefinitionSchema` omitting
 *  it — a future direct caller of `ScanDefinitionRepository.update()` (a script, a different
 *  service, a test helper) can't silently mutate this immutable discriminator field without a
 *  compile error. */
type ScanDefinitionUpdateFields = Omit<
  ScanDefinitionContentFields,
  "projectId" | "publicId" | "scanType"
>;

export interface ScanDefinitionListFilter {
  readonly projectId: string;
  readonly scanType?: ScanType;
  readonly isEnabled?: boolean;
  /** Fuzzy match on `name`. */
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export class ScanDefinitionRepository {
  private readonly model = getScanCenterModels().ScanDefinition;

  async create(
    input: Partial<ScanDefinitionContentFields> &
      Pick<ScanDefinitionContentFields, "projectId" | "publicId" | "name" | "scanType">,
  ): Promise<ScanDefinitionEntity> {
    const instance = await this.model.create({
      projectId: input.projectId,
      publicId: input.publicId,
      name: input.name,
      scanType: input.scanType,
      mode: input.mode ?? "manual",
      target: input.target ?? null,
      environment: input.environment ?? null,
      scheduleCron: input.scheduleCron ?? null,
      isEnabled: input.isEnabled ?? true,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<ScanDefinitionEntity>(instance);
  }

  async findById(id: string): Promise<ScanDefinitionEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<ScanDefinitionEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<ScanDefinitionEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<ScanDefinitionEntity>(instance) : null;
  }

  async list(filter: ScanDefinitionListFilter): Promise<readonly ScanDefinitionEntity[]> {
    const where: Record<string, unknown> = { projectId: filter.projectId };
    if (filter.scanType) {
      where.scanType = filter.scanType;
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
    return rows.map((row) => toEntityWithIsoDates<ScanDefinitionEntity>(row));
  }

  /** A plain, atomic `UPDATE ... RETURNING` — no CAS guard needed, a definition has no workflow of
   *  its own to race against. */
  async update(
    id: string,
    patch: Partial<ScanDefinitionUpdateFields>,
  ): Promise<ScanDefinitionEntity | null> {
    const [affectedCount, affectedRows] = await this.model.update(patch, {
      where: { id },
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<ScanDefinitionEntity>(affectedRows[0]);
  }
}
