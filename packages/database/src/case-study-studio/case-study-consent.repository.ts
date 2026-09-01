import { getCaseStudyStudioModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { CaseStudyConsentEntity, CaseStudyConsentType } from "./entities.js";

/** A real one-to-many child of `case_studies` — mirrors `ClaimSourceRepository`'s own "scoped to
 *  parent id" CRUD shape. */
export class CaseStudyConsentRepository {
  private readonly model = getCaseStudyStudioModels().CaseStudyConsent;

  async create(input: {
    caseStudyId: string;
    consentType: CaseStudyConsentType;
    consentEvidenceReference?: string | null;
    grantedBy?: string | null;
    grantedAt?: Date | null;
    notes?: string | null;
  }): Promise<CaseStudyConsentEntity> {
    const instance = await this.model.create({
      caseStudyId: input.caseStudyId,
      consentType: input.consentType,
      consentEvidenceReference: input.consentEvidenceReference ?? null,
      grantedBy: input.grantedBy ?? null,
      grantedAt: input.grantedAt ?? null,
      notes: input.notes ?? null,
    });
    return toEntityWithIsoDates<CaseStudyConsentEntity>(instance);
  }

  async findById(id: string): Promise<CaseStudyConsentEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<CaseStudyConsentEntity>(instance) : null;
  }

  async listByCaseStudy(caseStudyId: string): Promise<readonly CaseStudyConsentEntity[]> {
    const rows = await this.model.findAll({
      where: { caseStudyId },
      order: [["createdAt", "ASC"]],
    });
    return rows.map((row) => toEntityWithIsoDates<CaseStudyConsentEntity>(row));
  }

  /** `caseStudyId`-scoped (IDOR prevention) — a consent record from a different case study,
   *  accessed via this case study's own route, is treated as not found rather than silently
   *  updated. A single atomic `UPDATE ... RETURNING`, mirroring `ClaimSourceRepository.update()`'s
   *  own already-atomic shape. */
  async update(
    id: string,
    caseStudyId: string,
    patch: Partial<{
      consentType: CaseStudyConsentType;
      consentEvidenceReference: string | null;
      grantedBy: string | null;
      grantedAt: Date | null;
      notes: string | null;
    }>,
  ): Promise<CaseStudyConsentEntity | null> {
    const [affectedCount, affectedRows] = await this.model.update(patch, {
      where: { id, caseStudyId },
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<CaseStudyConsentEntity>(affectedRows[0]);
  }

  /** `caseStudyId`-scoped (IDOR prevention). Hard delete — a consent record has no dependent
   *  records of its own. */
  async remove(id: string, caseStudyId: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id, caseStudyId } });
    return count > 0;
  }
}
