import { getKeywordAndEntityLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { KeywordEntityRelationshipEntity } from "./entities.js";

/** A real many-to-many join between `keywords` and `entities` — mirrors `ClaimSourceRepository`'s
 *  own "scoped to parent id" CRUD shape (`packages/database/src/proof-and-claims-library/claim-source.repository.ts`),
 *  the closest existing precedent for a genuine child sub-resource, narrowed to create/list/remove
 *  since a relationship row has no content fields to edit in place — only create or remove. A
 *  duplicate `(keywordId, entityId)` submission is caught by the real unique index (migration
 *  `00060`); the service layer is responsible for translating that into a clean 400 via
 *  `isSequelizeUniqueConstraintError()` (mirrors every sibling module's own `create()` guard). */
export class KeywordEntityRelationshipRepository {
  private readonly model = getKeywordAndEntityLibraryModels().KeywordEntityRelationship;

  async create(
    keywordId: string,
    entityId: string,
    createdBy: string | null,
  ): Promise<KeywordEntityRelationshipEntity> {
    const instance = await this.model.create({ keywordId, entityId, createdBy });
    return toEntityWithIsoDates<KeywordEntityRelationshipEntity>(instance);
  }

  async listForKeyword(keywordId: string): Promise<readonly KeywordEntityRelationshipEntity[]> {
    const rows = await this.model.findAll({
      where: { keywordId },
      order: [["createdAt", "ASC"]],
    });
    return rows.map((row) => toEntityWithIsoDates<KeywordEntityRelationshipEntity>(row));
  }

  /** `keywordId`-scoped (IDOR prevention) — a relationship belonging to a different keyword,
   *  accessed via this keyword's own route, is treated as not found. */
  async remove(id: string, keywordId: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id, keywordId } });
    return count > 0;
  }
}
