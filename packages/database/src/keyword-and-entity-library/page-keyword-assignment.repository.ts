import { getKeywordAndEntityLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { PageKeywordAssignmentEntity } from "./entities.js";

/** A real join between `keywords` and Page Inventory's own `pages` — mirrors
 *  `KeywordEntityRelationshipRepository`'s own create/list/remove shape; `assignmentNote` is
 *  carried on create only, no separate `update()`. A duplicate `(keywordId, pageId)` submission
 *  is caught by the real unique index (migration `00060`); the service layer translates that into
 *  a clean 400 via `isSequelizeUniqueConstraintError()`. */
export class PageKeywordAssignmentRepository {
  private readonly model = getKeywordAndEntityLibraryModels().PageKeywordAssignment;

  async create(input: {
    keywordId: string;
    pageId: string;
    assignmentNote?: string | null;
    createdBy: string | null;
  }): Promise<PageKeywordAssignmentEntity> {
    const instance = await this.model.create({
      keywordId: input.keywordId,
      pageId: input.pageId,
      assignmentNote: input.assignmentNote ?? null,
      createdBy: input.createdBy,
    });
    return toEntityWithIsoDates<PageKeywordAssignmentEntity>(instance);
  }

  async listForKeyword(keywordId: string): Promise<readonly PageKeywordAssignmentEntity[]> {
    const rows = await this.model.findAll({
      where: { keywordId },
      order: [["createdAt", "ASC"]],
    });
    return rows.map((row) => toEntityWithIsoDates<PageKeywordAssignmentEntity>(row));
  }

  /** `keywordId`-scoped (IDOR prevention) — an assignment belonging to a different keyword,
   *  accessed via this keyword's own route, is treated as not found. */
  async remove(id: string, keywordId: string): Promise<boolean> {
    const count = await this.model.destroy({ where: { id, keywordId } });
    return count > 0;
  }
}
