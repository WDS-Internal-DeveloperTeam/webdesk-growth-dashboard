import { Op, literal } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getHelpCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { HelpArticleCategory, HelpArticleEntity } from "./entities.js";

export interface HelpArticleListFilter {
  readonly category?: HelpArticleCategory;
  readonly isPublished?: boolean;
  /** Fuzzy substring match on `title`, backed by the `help_articles_title_trgm_idx` GIN trigram
   *  index — wired from day one, not added later as a review-round fix. */
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/** The content fields a caller may set on create — `category`/`title`/`content` required,
 *  `isPublished` optional (defaults to `false`, resolved by the repository, the sole owner of
 *  this default — code-review finding: previously duplicated in both the service and here).
 *  Excludes `id`/`publishedAt`/`createdBy`/`updatedBy`/`createdAt`/`updatedAt`, all
 *  server-managed. */
type HelpArticleCreateFields = Pick<HelpArticleEntity, "category" | "title" | "content"> &
  Partial<Pick<HelpArticleEntity, "isPublished">>;

/** `category` is additionally excluded from the update shape — create-only, mirroring every
 *  sibling module's discriminator-field convention. `publishedAt` is never accepted here — it is
 *  entirely repository-managed (see `update()`'s own doc comment). */
type HelpArticleUpdateFields = Partial<
  Pick<HelpArticleEntity, "title" | "content" | "isPublished" | "updatedBy">
>;

// Mirrors BusinessKnowledgeRecordRepository's/KnowledgeLibraryRecordRepository's own
// DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** No `projectId` scoping anywhere here — this module's records are organization-wide, not tied
 *  to a `projects` row (help documentation is not tied to a single client project). */
export class HelpArticleRepository {
  private readonly model = getHelpCenterModels().HelpArticle;

  /**
   * `publishedAt` is stamped directly (a plain `NOW()`, not a `COALESCE`) when the article is
   * created already published — a fresh row has no prior `publishedAt` to preserve, unlike
   * `update()`'s stamp-once contract (code-review finding: this was previously left `null` on
   * create even when `isPublished: true`, contradicting the entity's own "stamped on first
   * transition to published" doc comment).
   */
  async create(
    input: HelpArticleCreateFields & { createdBy?: string | null },
  ): Promise<HelpArticleEntity> {
    const isPublished = input.isPublished ?? false;
    const instance = await this.model.create({
      category: input.category,
      title: input.title,
      content: input.content,
      isPublished,
      publishedAt: isPublished ? new Date() : null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<HelpArticleEntity>(instance);
  }

  async findById(id: string): Promise<HelpArticleEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<HelpArticleEntity>(instance) : null;
  }

  async list(filter: HelpArticleListFilter = {}): Promise<readonly HelpArticleEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.category) {
      where.category = filter.category;
    }
    if (filter.isPublished !== undefined) {
      where.isPublished = filter.isPublished;
    }
    if (filter.search) {
      where.title = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two separate
      // paginated queries (matches PersonaRepository.list()'s own precedent).
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<HelpArticleEntity>(row));
  }

  /**
   * Content update, including toggling `isPublished` — a plain field, not a governed workflow
   * transition (this module has no approval status to interact with, and no dedicated
   * publish/unpublish RBAC action exists for the seeded `system_settings` group). Deliberately
   * takes no pre-fetched "current" state — the atomic `COALESCE(published_at, NOW())` write
   * (a single `literal()` SQL string, matching `content_templates.published_at`'s/
   * `internal_links.implemented_at`'s own established idiom exactly — code-review finding: a
   * prior `fn()`/`col()`/`literal("NOW()")` composition was functionally equivalent but diverged
   * from every sibling repository's spelling of this pattern) means a first publish stamps the
   * real time while a repeat publish leaves the original stamp untouched, entirely at the SQL
   * layer, with no read-then-write race window and no extra round trip to determine it.
   */
  async update(id: string, patch: HelpArticleUpdateFields): Promise<HelpArticleEntity | null> {
    const values: Record<string, unknown> = { ...patch };
    if (patch.isPublished === true) {
      values.publishedAt = literal('COALESCE("published_at", NOW())');
    }

    const [affectedCount, affectedRows] = await this.model.update(values, {
      where: { id },
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<HelpArticleEntity>(affectedRows[0]);
  }
}
