import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  ImportErrorEntity,
  ImportErrorListFilter,
  ImportErrorRepository,
} from "@webdesk/database";
import { IMPORT_ERROR_REPOSITORY } from "./import-and-export-center.constants.js";

/**
 * Read-only, immutable — no update/delete route exists for `import_errors` (ADR-0016; created
 * only as a side effect of `ImportRunsService.changeStatus()`). No `projectId` scoping anywhere
 * here — IDOR scoping is instead against `importRunId` (the URL's own `:runId` path segment).
 */
@Injectable()
export class ImportErrorsService {
  constructor(@Inject(IMPORT_ERROR_REPOSITORY) private readonly errors: ImportErrorRepository) {}

  async findById(id: string, importRunId: string): Promise<ImportErrorEntity> {
    const error = await this.errors.findById(id);
    if (!error || error.importRunId !== importRunId) {
      throw new NotFoundException(`Import error not found: ${id}`);
    }
    return error;
  }

  async list(filter: ImportErrorListFilter): Promise<readonly ImportErrorEntity[]> {
    return this.errors.list(filter);
  }
}
