import { getCaseStudyStudioModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { CaseStudyAssetEntity, CaseStudyAssetRole } from "./entities.js";

/** A real many-to-many join into `assets` (D3) — mirrors `ClaimSourceRepository`'s own "scoped to
 *  parent id" CRUD shape, the closest existing precedent in this codebase for a genuine child
 *  sub-resource. */
export class CaseStudyAssetRepository {
  private readonly model = getCaseStudyStudioModels().CaseStudyAsset;

  async create(input: {
    caseStudyId: string;
    assetId: string;
    role: CaseStudyAssetRole;
    caption?: string | null;
  }): Promise<CaseStudyAssetEntity> {
    const instance = await this.model.create({
      caseStudyId: input.caseStudyId,
      assetId: input.assetId,
      role: input.role,
      caption: input.caption ?? null,
    });
    return toEntityWithIsoDates<CaseStudyAssetEntity>(instance);
  }

  async findById(id: string): Promise<CaseStudyAssetEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<CaseStudyAssetEntity>(instance) : null;
  }

  async listByCaseStudy(caseStudyId: string): Promise<readonly CaseStudyAssetEntity[]> {
    const rows = await this.model.findAll({
      where: { caseStudyId },
      order: [["createdAt", "ASC"]],
    });
    return rows.map((row) => toEntityWithIsoDates<CaseStudyAssetEntity>(row));
  }

  /** `caseStudyId`-scoped (IDOR prevention) — a join row from a different case study, accessed via
   *  this case study's own route, is treated as not found rather than silently updated. A single
   *  atomic `UPDATE ... RETURNING`, mirroring `ClaimSourceRepository.update()`'s own already-atomic
   *  shape. */
  async update(
    id: string,
    caseStudyId: string,
    patch: Partial<{ role: CaseStudyAssetRole; caption: string | null }>,
  ): Promise<CaseStudyAssetEntity | null> {
    const [affectedCount, affectedRows] = await this.model.update(patch, {
      where: { id, caseStudyId },
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<CaseStudyAssetEntity>(affectedRows[0]);
  }

  /** `caseStudyId`-scoped (IDOR prevention). Hard delete — a join row has no dependent records of
   *  its own. */
  async remove(id: string, caseStudyId: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id, caseStudyId } });
    return count > 0;
  }
}
