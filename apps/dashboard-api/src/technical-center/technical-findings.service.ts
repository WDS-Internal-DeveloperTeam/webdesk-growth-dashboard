import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  TechnicalFindingEntity,
  TechnicalFindingListFilter,
  TechnicalFindingRepository,
  TechnicalFindingStatus,
} from "@webdesk/database";
import {
  TECHNICAL_CENTER_MODULE_KEY,
  TECHNICAL_FINDING_REPOSITORY,
} from "./technical-center.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
import { unwrapCasResult } from "../common/cas-result.util.js";

/** No transition is disallowed from `open`/`acknowledged` (a reviewer may move a finding directly
 *  between any of the three dispositional states, or back to `open` to reconsider it); `resolved`/
 *  `dismissed` are both terminal — findings, once disposed, are not reopened in this pass. Mirrors
 *  `ScanFindingsService`'s own `TRANSITIONS` table byte-for-byte. */
const TRANSITIONS: Readonly<Record<TechnicalFindingStatus, ReadonlySet<TechnicalFindingStatus>>> = {
  open: new Set(["acknowledged", "resolved", "dismissed"]),
  acknowledged: new Set(["open", "resolved", "dismissed"]),
  resolved: new Set(),
  dismissed: new Set(),
};

@Injectable()
export class TechnicalFindingsService {
  constructor(
    @Inject(TECHNICAL_FINDING_REPOSITORY) private readonly findings: TechnicalFindingRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  /** `projectId`-scoped (IDOR prevention). */
  async findById(id: string, projectId: string): Promise<TechnicalFindingEntity> {
    const finding = await this.findings.findById(id);
    if (!finding || finding.projectId !== projectId) {
      throw new NotFoundException(`Technical finding not found: ${id}`);
    }
    return finding;
  }

  async list(filter: TechnicalFindingListFilter): Promise<readonly TechnicalFindingEntity[]> {
    return this.findings.list(filter);
  }

  async changeStatus(
    id: string,
    projectId: string,
    nextStatus: TechnicalFindingStatus,
    actorUserId: string,
  ): Promise<TechnicalFindingEntity> {
    const finding = await this.findById(id, projectId);

    if (finding.status === nextStatus) {
      return finding;
    }
    if (!TRANSITIONS[finding.status].has(nextStatus)) {
      throw new BadRequestException(
        `Invalid technical finding status transition: ${finding.status} -> ${nextStatus}`,
      );
    }

    await this.authorizationService.assertAllowed(
      actorUserId,
      TECHNICAL_CENTER_MODULE_KEY,
      "review",
      finding.projectId,
    );

    const result = await this.findings.updateStatus(id, finding.status, nextStatus, actorUserId);
    const updatedFinding = unwrapCasResult(
      result,
      () => `Technical finding not found: ${id}`,
      (entity) =>
        `Technical finding ${id} status changed concurrently (expected ${finding.status}, now ${entity.status}) — reload and retry`,
    );

    try {
      await this.auditService.record({
        eventType: "data_change",
        actorUserId,
        actorType: "human",
        projectId: finding.projectId,
        entityType: "technical_finding",
        entityId: id,
        action: `status:${finding.status}->${nextStatus}`,
        beforeState: { status: finding.status },
        afterState: { status: nextStatus },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(
        `Technical finding ${id} status transition ${finding.status}->${nextStatus} committed, but recording its audit event failed:`,
        error,
      );
    }

    return updatedFinding;
  }
}
