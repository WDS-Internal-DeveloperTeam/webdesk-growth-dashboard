import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { DeploymentEntity, DeploymentRepository } from "@webdesk/database";
import { DEPLOYMENT_REPOSITORY, RELEASE_TERMINAL_STATUSES } from "./release-center.constants.js";
import type { CreateDeploymentDto, ListDeploymentsQueryDto } from "./release-center.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ReleasesService } from "./releases.service.js";

/** An append-only history of every deploy attempt (ADR-0016 — no `update()`/`remove()` route
 *  exists here at all). Create/list only, mirroring `ScanEvidenceService`'s own shape. */
@Injectable()
export class DeploymentsService {
  constructor(
    @Inject(DEPLOYMENT_REPOSITORY) private readonly deployments: DeploymentRepository,
    private readonly releasesService: ReleasesService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    projectId: string,
    releaseId: string,
    input: CreateDeploymentDto,
    actorUserId: string,
  ): Promise<DeploymentEntity> {
    // Validates the release belongs to this project first (a clean 404, not a silently-accepted
    // dangling reference) — mirrors ScanEvidenceService.create()'s own "check the parent exists
    // first" precedent for this exact shape.
    const release = await this.releasesService.findById(releaseId, projectId);
    // Code-review finding: this guard was originally missing entirely, letting a caller record a
    // deployment attempt against an already-`completed`/`rolled_back` release — now matches
    // release-artifacts.service.ts's own terminal-state guard on writes.
    if (RELEASE_TERMINAL_STATUSES.has(release.status)) {
      throw new BadRequestException(
        `Release ${releaseId} has status '${release.status}' — no further deployments may be recorded`,
      );
    }

    const created = await this.deployments.create({
      releaseId: release.id,
      projectId,
      environment: input.environment,
      outcome: input.outcome,
      deployedByUserId: actorUserId,
      deployedAt: input.deployedAt ? new Date(input.deployedAt) : undefined,
      notes: input.notes,
    });

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId,
      entityType: "deployment",
      entityId: created.id,
      action: "create",
      afterState: {
        releaseId: created.releaseId,
        environment: created.environment,
        outcome: created.outcome,
      },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async list(
    projectId: string,
    releaseId: string,
    filter: ListDeploymentsQueryDto,
  ): Promise<readonly DeploymentEntity[]> {
    // Same project-membership check as create() — listing deployments for a release from another
    // project is treated as not found rather than silently returned.
    const release = await this.releasesService.findById(releaseId, projectId);
    return this.deployments.list({ ...filter, releaseId: release.id });
  }
}
