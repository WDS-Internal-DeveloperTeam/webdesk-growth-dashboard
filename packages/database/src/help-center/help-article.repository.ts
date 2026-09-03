import { Op, col, fn, literal } from "sequelize";
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
 *  `isPublished` optional (defaults to `false`). Excludes `id`/`publishedAt`/`createdBy`/
 *  `updatedBy`/`createdAt`/`updatedAt`, all server-managed. */
type HelpArticleCreateFields = Pick<HelpArticleEntity, "category" | "title" | "content"> &
  Partial<Pick<HelpArticleEntity, "isPublished">>;

/** `category` is additionally excluded from the update shape — create-only, mirroring every
 *  sibling module's discriminator-field convention. */
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

  async create(
    input: HelpArticleCreateFields & { createdBy?: string | null },
  ): Promise<HelpArticleEntity> {
    const instance = await this.model.create({
      category: input.category,
      title: input.title,
      content: input.content,
      isPublished: input.isPublished ?? false,
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
   * transition (this module has no approval status to interact with). `publishedAt` is
   * server-stamped atomically as part of the same `UPDATE`: when the patch sets
   * `isPublished: true`, it's written as `COALESCE(published_at, NOW())` via a Postgres `fn()`
   * literal (bound as a real parameterized argument, not string-interpolated), so a first publish
   * stamps the real time while a repeat publish leaves the original stamp untouched — the same
   * "stamp once" contract `content_templates.published_at`/`internal_links.implemented_at` already
   * establish, done here without a separate dedicated publish/unpublish action since none is
   * seeded for this module's RBAC group. `undefined`/omitted `isPublished` never touches
   * `publishedAt` at all.
   */
  async update(id: string, patch: HelpArticleUpdateFields): Promise<HelpArticleEntity | null> {
    const values: Record<string, unknown> = { ...patch };
    if (patch.isPublished === true) {
      values.publishedAt = fn("COALESCE", col("published_at"), literal("NOW()"));
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
