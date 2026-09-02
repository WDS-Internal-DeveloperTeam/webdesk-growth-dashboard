import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ImportRowEntity, ImportRowListFilter, ImportRowRepository } from "@webdesk/database";
import { IMPORT_ROW_REPOSITORY } from "./import-and-export-center.constants.js";

/**
 * Read-only — there is no standalone create/update route for `import_rows` (rows are bulk-created
 * only as a side effect of `ImportRunsService.changeStatus()`, this module's own scope doc). No
 * `projectId` scoping anywhere here — this module's records are organization-wide; IDOR scoping
 * for a single row is instead against its own `importRunId` (the URL's own `:runId` path segment).
 */
@Injectable()
export class ImportRowsService {
  constructor(@Inject(IMPORT_ROW_REPOSITORY) private readonly rows: ImportRowRepository) {}

  /** `importRunId`-scoped (IDOR prevention) — a row from a different run, accessed via this run's
   *  own route, is treated as not found rather than silently returned. */
  async findById(id: string, importRunId: string): Promise<ImportRowEntity> {
    const row = await this.rows.findById(id);
    if (!row || row.importRunId !== importRunId) {
      throw new NotFoundException(`Import row not found: ${id}`);
    }
    return row;
  }

  async list(filter: ImportRowListFilter): Promise<readonly ImportRowEntity[]> {
    return this.rows.list(filter);
  }
}
