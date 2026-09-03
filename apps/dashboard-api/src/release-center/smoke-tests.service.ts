import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { SmokeTestEntity, SmokeTestRepository } from "@webdesk/database";
import { RELEASE_TERMINAL_STATUSES, SMOKE_TEST_REPOSITORY } from "./release-center.constants.js";
import type { CreateSmokeTestDto, ListSmokeTestsQueryDto } from "./release-center.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ReleasesService } from "./releases.service.js";

/** Create/list only (ADR-0016 — no `update()`/`remove()` route exists here at all), mirroring
 *  `ScanEvidenceService`'s own shape. */
@Injectable()
export class SmokeTestsService {
  constructor(
    @Inject(SMOKE_TEST_REPOSITORY) private readonly smokeTests: SmokeTestRepository,
    private readonly releasesService: ReleasesService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    projectId: string,
    releaseId: string,
    input: CreateSmokeTestDto,
    actorUserId: string,
  ): Promise<SmokeTestEntity> {
    // Validates the release belongs to this project first (a clean 404, not a silently-accepted
    // dangling reference) — mirrors ScanEvidenceService.create()'s own "check the parent exists
    // first" precedent for this exact shape.
    const release = await this.releasesService.findById(releaseId, projectId);
    // Code-review finding: this guard was originally missing entirely, letting a caller record a
    // smoke test against an already-`completed`/`rolled_back` release — now matches
    // release-artifacts.service.ts's own terminal-state guard on writes.
    if (RELEASE_TERMINAL_STATUSES.has(release.status)) {
      throw new BadRequestException(
        `Release ${releaseId} has status '${release.status}' — no further smoke tests may be recorded`,
      );
    }

    const created = await this.smokeTests.create({
      releaseId: release.id,
      projectId,
      environment: input.environment,
      name: input.name,
      result: input.result,
      ranAt: input.ranAt ? new Date(input.ranAt) : undefined,
      notes: input.notes,
    });

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId,
      entityType: "smoke_test",
      entityId: created.id,
      action: "create",
      afterState: { releaseId: created.releaseId, name: created.name, result: created.result },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async list(
    projectId: string,
    releaseId: string,
    filter: ListSmokeTestsQueryDto,
  ): Promise<readonly SmokeTestEntity[]> {
    // Same project-membership check as create() — listing smoke tests for a release from another
    // project is treated as not found rather than silently returned.
    const release = await this.releasesService.findById(releaseId, projectId);
    return this.smokeTests.list({ ...filter, releaseId: release.id });
  }
}
