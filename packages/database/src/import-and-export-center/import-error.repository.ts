import { getImportAndExportCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ImportErrorEntity } from "./entities.js";

type ImportErrorContentFields = Omit<ImportErrorEntity, "id" | "createdAt">;

export interface ImportErrorListFilter {
  readonly importRunId: string;
  readonly limit?: number;
  readonly offset?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** Immutable, append-only (ADR-0016) — no `update()`/`delete()` method exists here at all, mirrors
 *  `ScanEvidenceRepository`'s own read/create-only shape. */
export class ImportErrorRepository {
  private readonly model = getImportAndExportCenterModels().ImportError;

  /** Inserts every error in one statement, atomically — used only by
   *  `ImportRunsService.changeStatus()`, mirroring `ImportRowRepository.bulkCreate()`'s own
   *  reasoning. */
  async bulkCreate(
    inputs: readonly (Partial<ImportErrorContentFields> &
      Pick<ImportErrorContentFields, "importRunId" | "message">)[],
  ): Promise<readonly ImportErrorEntity[]> {
    if (inputs.length === 0) {
      return [];
    }
    const instances = await this.model.bulkCreate(
      inputs.map((input) => ({
        importRunId: input.importRunId,
        importRowId: input.importRowId ?? null,
        errorCode: input.errorCode ?? null,
        message: input.message,
        fieldName: input.fieldName ?? null,
      })),
    );
    return instances.map((instance) => toEntityWithIsoDates<ImportErrorEntity>(instance));
  }

  async findById(id: string): Promise<ImportErrorEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<ImportErrorEntity>(instance) : null;
  }

  async list(filter: ImportErrorListFilter): Promise<readonly ImportErrorEntity[]> {
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where: { importRunId: filter.importRunId },
      order: [["createdAt", "ASC"]],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<ImportErrorEntity>(row));
  }
}
