import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ReleaseArtifactEntity, ReleaseArtifactRepository } from "@webdesk/database";
import {
  RELEASE_ARTIFACT_REPOSITORY,
  RELEASE_TERMINAL_STATUSES,
} from "./release-center.constants.js";
import type {
  CreateReleaseArtifactDto,
  ListReleaseArtifactsQueryDto,
} from "./release-center.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ReleasesService } from "./releases.service.js";

/** A real one-to-many child of `releases` ("repositories and SHAs, PRs") — create/list/delete
 *  only (no update route, per the design doc's own sub-resource endpoint list). Delete is rejected
 *  once the parent release is `completed`/`rolled_back` (`RELEASE_TERMINAL_STATUSES`). */

@Injectable()
export class ReleaseArtifactsService {
  constructor(
    @Inject(RELEASE_ARTIFACT_REPOSITORY) private readonly artifacts: ReleaseArtifactRepository,
    private readonly releasesService: ReleasesService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    projectId: string,
    releaseId: string,
    input: CreateReleaseArtifactDto,
    actorUserId: string,
  ): Promise<ReleaseArtifactEntity> {
    // Validates the release belongs to this project first (a clean 404, not a silently-accepted
    // dangling reference) — mirrors ScanEvidenceService.create()'s own "check the parent exists
    // first" precedent for this exact shape.
    const release = await this.releasesService.findById(releaseId, projectId);

    const created = await this.artifacts.create({
      releaseId: release.id,
      projectId,
      repoOwner: input.repoOwner,
      repoName: input.repoName,
      commitSha: input.commitSha,
      prUrl: input.prUrl,
      createdBy: actorUserId,
    });

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId,
      entityType: "release_artifact",
      entityId: created.id,
      action: "create",
      afterState: {
        releaseId: created.releaseId,
        repoOwner: created.repoOwner,
        repoName: created.repoName,
      },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async list(
    projectId: string,
    releaseId: string,
    filter: ListReleaseArtifactsQueryDto,
  ): Promise<readonly ReleaseArtifactEntity[]> {
    // Same project-membership check as create() — listing artifacts for a release from another
    // project is treated as not found rather than silently returned.
    const release = await this.releasesService.findById(releaseId, projectId);
    return this.artifacts.list({ ...filter, releaseId: release.id });
  }

  async remove(
    projectId: string,
    releaseId: string,
    artifactId: string,
    actorUserId: string,
  ): Promise<void> {
    const release = await this.releasesService.findById(releaseId, projectId);
    if (RELEASE_TERMINAL_STATUSES.has(release.status)) {
      throw new BadRequestException(
        `Release ${releaseId} has status '${release.status}' — artifacts can no longer be removed`,
      );
    }

    const removed = await this.artifacts.remove(artifactId, release.id);
    if (!removed) {
      throw new NotFoundException(`Release artifact not found: ${artifactId}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId,
      entityType: "release_artifact",
      entityId: artifactId,
      action: "delete",
      afterState: { releaseId: release.id },
      retentionCategory: "audit-7y",
    });
  }
}
