import { literal, Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getImportAndExportCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ImportTemplateEntity } from "./entities.js";

type ImportTemplateContentFields = Omit<
  ImportTemplateEntity,
  "id" | "version" | "createdAt" | "updatedAt"
>;

/** `update()`'s patch shape — `publicId`/`targetModuleKey` are both excluded, both immutable after
 *  create (mirrors `ScanDefinitionUpdateFields`'s own `scanType`-exclusion precedent). Enforced
 *  here at the type level, not just by `updateImportTemplateSchema` omitting them. */
type ImportTemplateUpdateFields = Omit<ImportTemplateContentFields, "publicId" | "targetModuleKey">;

export interface ImportTemplateListFilter {
  readonly targetModuleKey?: string;
  readonly isActive?: boolean;
  /** Fuzzy match on `name`. */
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** No `projectId` scoping anywhere here — this module's records are organization-wide. */
export class ImportTemplateRepository {
  private readonly model = getImportAndExportCenterModels().ImportTemplate;

  async create(
    input: Partial<ImportTemplateContentFields> &
      Pick<ImportTemplateContentFields, "publicId" | "name" | "targetModuleKey" | "fileFormat">,
  ): Promise<ImportTemplateEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      name: input.name,
      targetModuleKey: input.targetModuleKey,
      columnMapping: input.columnMapping ?? null,
      duplicateStrategyDefault: input.duplicateStrategyDefault ?? "skip",
      fileFormat: input.fileFormat,
      version: 1,
      isActive: input.isActive ?? true,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<ImportTemplateEntity>(instance);
  }

  async findById(id: string): Promise<ImportTemplateEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<ImportTemplateEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<ImportTemplateEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<ImportTemplateEntity>(instance) : null;
  }

  async list(filter: ImportTemplateListFilter = {}): Promise<readonly ImportTemplateEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.targetModuleKey) {
      where.targetModuleKey = filter.targetModuleKey;
    }
    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
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
    return rows.map((row) => toEntityWithIsoDates<ImportTemplateEntity>(row));
  }

  /**
   * A plain, atomic `UPDATE ... RETURNING` — no CAS guard needed, a template has no workflow of
   * its own to race against (only `import_runs` has one). `version` is incremented by 1 as part of
   * the same `UPDATE` statement via a Postgres-evaluated `version + 1` literal — avoiding a
   * read-then-write race, `returning: true` gets the post-update row (including the server-
   * computed `version`) back from the `UPDATE` itself rather than a second round trip. Mirrors
   * `PersonaRepository.update()`'s own identical pattern.
   */
  async update(
    id: string,
    patch: Partial<ImportTemplateUpdateFields>,
  ): Promise<ImportTemplateEntity | null> {
    const [affectedCount, affectedRows] = await this.model.update(
      { ...patch, version: literal("version + 1") },
      { where: { id }, returning: true },
    );
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<ImportTemplateEntity>(affectedRows[0]);
  }
}
