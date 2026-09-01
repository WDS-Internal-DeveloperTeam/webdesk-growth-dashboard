import { getPortfolioLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { PortfolioAssetEntity } from "./entities.js";

/** A real many-to-many join into `assets` (D2) — mirrors `CaseStudyAssetRepository`'s own
 *  "scoped to parent id" CRUD shape exactly. */
export class PortfolioAssetRepository {
  private readonly model = getPortfolioLibraryModels().PortfolioAsset;

  async create(input: {
    portfolioRecordId: string;
    assetId: string;
    role: string;
    caption?: string | null;
  }): Promise<PortfolioAssetEntity> {
    const instance = await this.model.create({
      portfolioRecordId: input.portfolioRecordId,
      assetId: input.assetId,
      role: input.role,
      caption: input.caption ?? null,
    });
    return toEntityWithIsoDates<PortfolioAssetEntity>(instance);
  }

  async findById(id: string): Promise<PortfolioAssetEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<PortfolioAssetEntity>(instance) : null;
  }

  async listByPortfolioRecord(portfolioRecordId: string): Promise<readonly PortfolioAssetEntity[]> {
    const rows = await this.model.findAll({
      where: { portfolioRecordId },
      order: [["createdAt", "ASC"]],
    });
    return rows.map((row) => toEntityWithIsoDates<PortfolioAssetEntity>(row));
  }

  /** `portfolioRecordId`-scoped (IDOR prevention) — a join row from a different portfolio record,
   *  accessed via this record's own route, is treated as not found rather than silently updated. A
   *  single atomic `UPDATE ... RETURNING`, mirroring `CaseStudyAssetRepository.update()`'s own
   *  already-atomic shape. */
  async update(
    id: string,
    portfolioRecordId: string,
    patch: Partial<{ role: string; caption: string | null }>,
  ): Promise<PortfolioAssetEntity | null> {
    const [affectedCount, affectedRows] = await this.model.update(patch, {
      where: { id, portfolioRecordId },
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<PortfolioAssetEntity>(affectedRows[0]);
  }

  /** `portfolioRecordId`-scoped (IDOR prevention). Hard delete — a join row has no dependent
   *  records of its own. */
  async remove(id: string, portfolioRecordId: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id, portfolioRecordId } });
    return count > 0;
  }
}
