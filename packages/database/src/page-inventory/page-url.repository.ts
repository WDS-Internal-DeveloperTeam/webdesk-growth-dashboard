import { getPageInventoryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { PageUrlEntity } from "./entities.js";

/** A real one-to-many child of `pages` — mirrors `ClaimSourceRepository`'s own "scoped to parent
 *  id" CRUD shape (`packages/database/src/proof-and-claims-library/claim-source.repository.ts`),
 *  the closest existing precedent in this codebase for a genuine child sub-resource. */
export class PageUrlRepository {
  private readonly model = getPageInventoryModels().PageUrl;

  /** `projectId` is always supplied by the service layer (denormalized from the parent page's own
   *  `projectId`, never accepted from a caller) — see `entities.ts`'s `PageUrlEntity` doc comment
   *  for why. */
  async create(input: {
    pageId: string;
    projectId: string;
    url: string;
    isCanonical?: boolean;
  }): Promise<PageUrlEntity> {
    const instance = await this.model.create({
      pageId: input.pageId,
      projectId: input.projectId,
      url: input.url,
      isCanonical: input.isCanonical ?? true,
    });
    return toEntityWithIsoDates<PageUrlEntity>(instance);
  }

  async findById(id: string): Promise<PageUrlEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<PageUrlEntity>(instance) : null;
  }

  async listByPage(pageId: string): Promise<readonly PageUrlEntity[]> {
    const rows = await this.model.findAll({
      where: { pageId },
      order: [["createdAt", "ASC"]],
    });
    return rows.map((row) => toEntityWithIsoDates<PageUrlEntity>(row));
  }

  /** `pageId`-scoped — the same IDOR-prevention shape every sub-resource repository in this
   *  codebase already has (`ClaimSourceRepository.update()`'s own doc comment records the fix this
   *  mirrors from day one). A URL belonging to a different page is treated as not found. A single
   *  atomic `UPDATE ... RETURNING`, not a separate `findOne()` + `instance.update()`. */
  async update(
    id: string,
    pageId: string,
    patch: Partial<{ url: string; isCanonical: boolean }>,
  ): Promise<PageUrlEntity | null> {
    const [affectedCount, affectedRows] = await this.model.update(patch, {
      where: { id, pageId },
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<PageUrlEntity>(affectedRows[0]);
  }

  /** `pageId`-scoped (IDOR fix). Hard delete — a URL has no dependent records of its own. */
  async remove(id: string, pageId: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id, pageId } });
    return count > 0;
  }
}
