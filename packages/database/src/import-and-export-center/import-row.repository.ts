import { getImportAndExportCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ImportRowEntity, ImportRowStatus } from "./entities.js";

type ImportRowContentFields = Omit<ImportRowEntity, "id" | "createdAt" | "updatedAt">;

export interface ImportRowListFilter {
  readonly importRunId: string;
  readonly status?: ImportRowStatus;
  readonly limit?: number;
  readonly offset?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export class ImportRowRepository {
  private readonly model = getImportAndExportCenterModels().ImportRow;

  /** Inserts every row in one statement, atomically — used only by `ImportRunsService.changeStatus()`
   *  when a run transitions into `dry_run_completed`/`importing` with a real rows payload. Mirrors
   *  `ScanFindingRepository.bulkCreate()`'s own "one statement, not a per-row loop" reasoning. */
  async bulkCreate(
    inputs: readonly (Partial<ImportRowContentFields> &
      Pick<ImportRowContentFields, "importRunId" | "rowNumber" | "status">)[],
  ): Promise<readonly ImportRowEntity[]> {
    if (inputs.length === 0) {
      return [];
    }
    const instances = await this.model.bulkCreate(
      inputs.map((input) => ({
        importRunId: input.importRunId,
        rowNumber: input.rowNumber,
        externalId: input.externalId ?? null,
        rawData: input.rawData ?? null,
        status: input.status,
        resolution: input.resolution ?? null,
      })),
    );
    return instances.map((instance) => toEntityWithIsoDates<ImportRowEntity>(instance));
  }

  async findById(id: string): Promise<ImportRowEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<ImportRowEntity>(instance) : null;
  }

  async list(filter: ImportRowListFilter): Promise<readonly ImportRowEntity[]> {
    const where: Record<string, unknown> = { importRunId: filter.importRunId };
    if (filter.status) {
      where.status = filter.status;
    }

    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // Matches the natural presentation order of a run's own rows, and the migration's own
      // `import_rows_import_run_id_row_number_idx` composite index.
      order: [["rowNumber", "ASC"]],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<ImportRowEntity>(row));
  }
}
