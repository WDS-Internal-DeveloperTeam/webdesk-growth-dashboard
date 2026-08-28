import { getAssetLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { AssetRelatedRecordEntity } from "./entities.js";

/**
 * Spec §12's "related records" (D3) — a genuine Projects-style sub-resource of one asset.
 *
 * Every read/write below is scoped by `(id, assetId)`, never by `id` alone — real DB-level IDOR
 * prevention, mirroring `ClaimSourceRepository`'s own `(id, claimId)` scoping exactly. Without it,
 * a caller authorized on asset A could mutate asset B's relationship rows by guessing an id.
 *
 * `moduleKey` is validated against the real module registry at the SERVICE layer
 * (`AuthorizationService.isValidModuleKey()`), not here — the repository layer in this codebase
 * never reaches across module boundaries, per ADR-0006.
 */
export class AssetRelatedRecordRepository {
  private readonly model = getAssetLibraryModels().AssetRelatedRecord;

  async create(input: {
    assetId: string;
    moduleKey: string;
    recordId: string;
    note?: string | null;
    createdBy?: string | null;
  }): Promise<AssetRelatedRecordEntity> {
    const instance = await this.model.create({
      assetId: input.assetId,
      moduleKey: input.moduleKey,
      recordId: input.recordId,
      note: input.note ?? null,
      createdBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<AssetRelatedRecordEntity>(instance);
  }

  /** Scoped by `(id, assetId)` — IDOR prevention, see the class doc comment. */
  async findById(id: string, assetId: string): Promise<AssetRelatedRecordEntity | null> {
    const instance = await this.model.findOne({ where: { id, assetId } });
    return instance ? toEntityWithIsoDates<AssetRelatedRecordEntity>(instance) : null;
  }

  async listByAsset(assetId: string): Promise<readonly AssetRelatedRecordEntity[]> {
    const rows = await this.model.findAll({
      where: { assetId },
      // `id` is a secondary sort key so ties on `createdAt` produce a stable order, matching the
      // same tiebreaker every list query in this codebase uses.
      order: [
        ["createdAt", "ASC"],
        ["id", "ASC"],
      ],
    });
    return rows.map((row) => toEntityWithIsoDates<AssetRelatedRecordEntity>(row));
  }

  /**
   * The reverse question — "which assets reference this record?" — the real point of tracking
   * usage at all (`Recommended_Module_Roadmap.md:49`). Backed by the
   * `asset_related_records_target_idx` composite index on `(module_key, record_id)`.
   */
  async listByTarget(
    moduleKey: string,
    recordId: string,
  ): Promise<readonly AssetRelatedRecordEntity[]> {
    const rows = await this.model.findAll({
      where: { moduleKey, recordId },
      order: [
        ["createdAt", "ASC"],
        ["id", "ASC"],
      ],
    });
    return rows.map((row) => toEntityWithIsoDates<AssetRelatedRecordEntity>(row));
  }

  async findByTargetForAsset(
    assetId: string,
    moduleKey: string,
    recordId: string,
  ): Promise<AssetRelatedRecordEntity | null> {
    const instance = await this.model.findOne({ where: { assetId, moduleKey, recordId } });
    return instance ? toEntityWithIsoDates<AssetRelatedRecordEntity>(instance) : null;
  }

  /**
   * A single atomic `UPDATE ... RETURNING` scoped by `(id, assetId)`, not a `findOne()` +
   * `instance.update()` pair — mirrors the fix Proof and Claims Library's own code review already
   * applied to `ClaimSourceRepository.update()` for exactly this reason: the two-step form is a
   * needless round trip with a race window between the read and the write.
   *
   * Only `note` is patchable. `moduleKey`/`recordId` together ARE the relationship's identity —
   * repointing one at a different target is a delete plus a create, not an edit, and allowing it
   * here would silently bypass the service layer's own `isValidModuleKey()` validation of the new
   * target.
   */
  async update(
    id: string,
    assetId: string,
    patch: { note?: string | null },
  ): Promise<AssetRelatedRecordEntity | null> {
    const [affectedCount, affectedRows] = await this.model.update(patch, {
      where: { id, assetId },
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<AssetRelatedRecordEntity>(affectedRows[0]);
  }

  /** Scoped by `(id, assetId)` — IDOR prevention, see the class doc comment. A relationship row is
   *  pure linkage metadata carrying no approval history of its own, so unlike an asset itself
   *  (which is retired via `archived`, ADR-0016) it is genuinely hard-deletable, matching
   *  `ClaimSourceRepository.remove()`'s own identical treatment of the same kind of row. */
  async remove(id: string, assetId: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id, assetId } });
    return count > 0;
  }
}
