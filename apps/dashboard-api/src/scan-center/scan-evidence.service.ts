import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type {
  ScanEvidenceEntity,
  ScanEvidenceListFilter,
  ScanEvidenceRepository,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import { SCAN_EVIDENCE_REPOSITORY } from "./scan-center.constants.js";
import type { CreateScanEvidenceDto } from "./scan-center.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ScanFindingsService } from "./scan-findings.service.js";

/** No update/delete — evidence is immutable once created. */
@Injectable()
export class ScanEvidenceService {
  constructor(
    @Inject(SCAN_EVIDENCE_REPOSITORY) private readonly evidence: ScanEvidenceRepository,
    private readonly findingsService: ScanFindingsService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    projectId: string,
    findingId: string,
    input: CreateScanEvidenceDto,
    actorUserId: string,
  ): Promise<ScanEvidenceEntity> {
    // Validates the finding belongs to this project first (a clean 404, not a silently-accepted
    // dangling reference) — mirrors ClaimSourcesService's own "check the parent exists first"
    // precedent for this exact shape.
    const finding = await this.findingsService.findById(findingId, projectId);

    let created: ScanEvidenceEntity;
    try {
      created = await this.evidence.create({
        projectId,
        publicId: input.publicId,
        scanFindingId: finding.id,
        evidenceType: input.evidenceType,
        reference: input.reference,
        notes: input.notes,
        capturedAt: input.capturedAt,
        createdBy: actorUserId,
      });
    } catch (error) {
      // `scan_evidence.public_id` is globally unique (migration 00103) — without this catch, a
      // duplicate publicId would surface as a raw 500 instead of a clean 400, the same bug class
      // already fixed once in ScanDefinitionsService.create()/ScanRunsService.create() (this
      // service alone was missing it).
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(`publicId already in use: ${input.publicId}`);
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId,
      entityType: "scan_evidence",
      entityId: created.id,
      action: "create",
      afterState: { scanFindingId: created.scanFindingId },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async list(
    projectId: string,
    findingId: string,
    filter: Omit<ScanEvidenceListFilter, "scanFindingId">,
  ): Promise<readonly ScanEvidenceEntity[]> {
    // Same project-membership check as create() — listing evidence for a finding from another
    // project is treated as not found rather than silently returned.
    const finding = await this.findingsService.findById(findingId, projectId);
    return this.evidence.list({ ...filter, scanFindingId: finding.id });
  }
}
