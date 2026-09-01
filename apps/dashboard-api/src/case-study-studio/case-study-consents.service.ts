import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  CaseStudyConsentEntity,
  CaseStudyConsentRepository,
  CaseStudyRepository,
} from "@webdesk/database";
import {
  CASE_STUDY_CONSENT_REPOSITORY,
  CASE_STUDY_REPOSITORY,
} from "./case-study-studio.constants.js";
import type {
  CreateCaseStudyConsentDto,
  UpdateCaseStudyConsentDto,
} from "./case-study-studio.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";

function toGrantedAtDate(value: string | null | undefined): Date | null | undefined {
  return value === undefined ? undefined : value === null ? null : new Date(value);
}

/**
 * Case-study consent CRUD, scoped to a parent case study — mirrors `ClaimSourcesService`'s own
 * shape. Not independently governed by the parent case study's status workflow — the same
 * `edit`-level tier as editing the case study's own content fields.
 */
@Injectable()
export class CaseStudyConsentsService {
  constructor(
    @Inject(CASE_STUDY_CONSENT_REPOSITORY)
    private readonly caseStudyConsents: CaseStudyConsentRepository,
    @Inject(CASE_STUDY_REPOSITORY) private readonly caseStudies: CaseStudyRepository,
    private readonly auditService: AuditService,
  ) {}

  /** `case_study_consents.case_study_id` is FK-constrained (migration `00091`), but a well-formed,
   *  nonexistent `caseStudyId` was previously only caught at the database layer — surfacing as a
   *  raw, unhandled 500 instead of a clean 404 (mirrors `ClaimSourcesService.create()`'s own
   *  identical guard). */
  async create(
    caseStudyId: string,
    input: CreateCaseStudyConsentDto,
    actorUserId: string,
  ): Promise<CaseStudyConsentEntity> {
    const caseStudy = await this.caseStudies.findById(caseStudyId);
    if (!caseStudy) {
      throw new NotFoundException(`Case study not found: ${caseStudyId}`);
    }

    const created = await this.caseStudyConsents.create({
      caseStudyId,
      consentType: input.consentType,
      consentEvidenceReference: input.consentEvidenceReference,
      grantedBy: input.grantedBy,
      grantedAt: toGrantedAtDate(input.grantedAt) ?? null,
      notes: input.notes,
    });

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "case_study_consent",
      entityId: created.id,
      action: "create",
      afterState: { caseStudyId, consentType: created.consentType },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async findById(id: string): Promise<CaseStudyConsentEntity> {
    const consent = await this.caseStudyConsents.findById(id);
    if (!consent) {
      throw new NotFoundException(`Case study consent not found: ${id}`);
    }
    return consent;
  }

  async listByCaseStudy(caseStudyId: string): Promise<readonly CaseStudyConsentEntity[]> {
    return this.caseStudyConsents.listByCaseStudy(caseStudyId);
  }

  /** `caseStudyId`-scoped (IDOR prevention). */
  async update(
    id: string,
    caseStudyId: string,
    patch: UpdateCaseStudyConsentDto,
    actorUserId: string,
  ): Promise<CaseStudyConsentEntity> {
    const updated = await this.caseStudyConsents.update(id, caseStudyId, {
      ...patch,
      grantedAt: toGrantedAtDate(patch.grantedAt),
    });
    if (!updated) {
      throw new NotFoundException(`Case study consent not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "case_study_consent",
      entityId: id,
      action: "update",
      afterState: { caseStudyId, ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  /** `caseStudyId`-scoped (IDOR prevention), same as `update()`. */
  async remove(id: string, caseStudyId: string, actorUserId: string): Promise<void> {
    const consent = await this.findById(id);
    if (consent.caseStudyId !== caseStudyId) {
      throw new NotFoundException(`Case study consent not found: ${id}`);
    }

    const removed = await this.caseStudyConsents.remove(id, caseStudyId);
    if (!removed) {
      throw new NotFoundException(`Case study consent not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "case_study_consent",
      entityId: id,
      action: "delete",
      beforeState: { caseStudyId, consentType: consent.consentType },
      retentionCategory: "audit-7y",
    });
  }
}
