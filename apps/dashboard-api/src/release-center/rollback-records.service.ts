import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { RollbackRecordEntity, RollbackRecordRepository } from "@webdesk/database";
import { ROLLBACK_RECORD_REPOSITORY } from "./release-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ReleasesService } from "./releases.service.js";

/**
 * Read-only — the row itself is written by `ReleasesService.changeStatus()`, in the same
 * transaction as the parent release's own CAS status write on any `-> rolled_back` transition. One
 * route only: `GET .../releases/:id/rollback`.
 */
@Injectable()
export class RollbackRecordsService {
  constructor(
    @Inject(ROLLBACK_RECORD_REPOSITORY)
    private readonly rollbackRecords: RollbackRecordRepository,
    private readonly releasesService: ReleasesService,
  ) {}

  /** `projectId`-scoped (IDOR prevention) via `ReleasesService.findById()` — a release from a
   *  different project, accessed via this project's own route, is treated as not found. Throws a
   *  clean 404 when the release has never been rolled back (at most one per release,
   *  `rollback_records_release_id_unique`). */
  async findByReleaseId(id: string, projectId: string): Promise<RollbackRecordEntity> {
    await this.releasesService.findById(id, projectId);
    const record = await this.rollbackRecords.findByReleaseId(id);
    if (!record) {
      throw new NotFoundException(`Release ${id} has no rollback record`);
    }
    return record;
  }
}
