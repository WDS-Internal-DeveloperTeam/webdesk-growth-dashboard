import { getProofAndClaimsLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ClaimSourceEntity } from "./entities.js";

/** A real one-to-many child of `proof_claims` — mirrors `RoadmapItemRepository`'s own
 *  "scoped to parent id" CRUD shape (`packages/database/src/projects/roadmap-item.repository.ts`),
 *  the closest existing precedent in this codebase for a genuine child sub-resource. */
export class ClaimSourceRepository {
  private readonly model = getProofAndClaimsLibraryModels().ClaimSource;

  async create(input: {
    claimId: string;
    source: string;
    sourceUrl?: string | null;
  }): Promise<ClaimSourceEntity> {
    const instance = await this.model.create({
      claimId: input.claimId,
      source: input.source,
      sourceUrl: input.sourceUrl ?? null,
    });
    return toEntityWithIsoDates<ClaimSourceEntity>(instance);
  }

  async findById(id: string): Promise<ClaimSourceEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<ClaimSourceEntity>(instance) : null;
  }

  async listByClaim(claimId: string): Promise<readonly ClaimSourceEntity[]> {
    const rows = await this.model.findAll({
      where: { claimId },
      order: [["createdAt", "ASC"]],
    });
    return rows.map((row) => toEntityWithIsoDates<ClaimSourceEntity>(row));
  }

  /** `claimId`-scoped — the same IDOR-prevention shape every sub-resource repository in this
   *  codebase already has (`RoadmapItemRepository.update()`'s own doc comment records the fix this
   *  mirrors from day one). A source belonging to a different claim is treated as not found. */
  async update(
    id: string,
    claimId: string,
    patch: Partial<{ source: string; sourceUrl: string | null }>,
  ): Promise<ClaimSourceEntity | null> {
    const instance = await this.model.findOne({ where: { id, claimId } });
    if (!instance) {
      return null;
    }
    await instance.update(patch);
    return toEntityWithIsoDates<ClaimSourceEntity>(instance);
  }

  /** `claimId`-scoped (IDOR fix). Hard delete — a source has no dependent records of its own. */
  async remove(id: string, claimId: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id, claimId } });
    return count > 0;
  }
}
