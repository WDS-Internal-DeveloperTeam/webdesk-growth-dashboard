import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  HelpArticleEntity,
  HelpArticleListFilter,
  HelpArticleRepository,
} from "@webdesk/database";
import { sanitizeRichTextHtml } from "@webdesk/validation";
import { HELP_ARTICLE_REPOSITORY } from "./help-center.constants.js";
import type { CreateHelpArticleDto, UpdateHelpArticleDto } from "./help-center.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";

@Injectable()
export class HelpArticlesService {
  constructor(
    @Inject(HELP_ARTICLE_REPOSITORY) private readonly articles: HelpArticleRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateHelpArticleDto, actorUserId: string): Promise<HelpArticleEntity> {
    // `isPublished`'s `?? false` default is the repository's own responsibility, not
    // re-duplicated here (code-review finding).
    const created = await this.articles.create({
      category: input.category,
      title: input.title,
      content: sanitizeRichTextHtml(input.content),
      isPublished: input.isPublished,
      createdBy: actorUserId,
    });

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "help_article",
      entityId: created.id,
      action: "create",
      afterState: { category: created.category, isPublished: created.isPublished },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async findById(id: string): Promise<HelpArticleEntity> {
    const article = await this.articles.findById(id);
    if (!article) {
      throw new NotFoundException(`Help article not found: ${id}`);
    }
    return article;
  }

  async list(filter: HelpArticleListFilter): Promise<readonly HelpArticleEntity[]> {
    return this.articles.list(filter);
  }

  /**
   * Content update, including toggling `isPublished` — a plain field on this module (no approval
   * workflow, no dedicated publish/unpublish RBAC action exists for the seeded `system_settings`
   * group), gated only on `edit`. Deliberately does NOT pre-fetch the current row (code-review
   * finding: an earlier version did, purely to skip re-sanitizing unchanged content and to diff
   * `isPublished` against its prior value — both real DB round trip + a stale-read race, since two
   * concurrent requests could both observe the same "before" state and each classify their own
   * write as a fresh publish/unpublish). `content` is unconditionally re-sanitized when present
   * (sanitization is cheap and idempotent — safe to re-run on already-sanitized HTML), and the
   * audit `eventType` is derived purely from the caller's own requested `isPublished` value rather
   * than an observed transition — an `isPublished: true` patch is always an honest "this caller
   * requested a publish," whether or not the article happened to already be published (the
   * repository's own atomic `COALESCE` still guarantees `publishedAt` is stamped at most once
   * regardless of how many "publish" requests land).
   */
  async update(
    id: string,
    patch: UpdateHelpArticleDto,
    actorUserId: string,
  ): Promise<HelpArticleEntity> {
    const updated = await this.articles.update(id, {
      title: patch.title,
      content: patch.content !== undefined ? sanitizeRichTextHtml(patch.content) : undefined,
      isPublished: patch.isPublished,
      updatedBy: actorUserId,
    });
    if (!updated) {
      throw new NotFoundException(`Help article not found: ${id}`);
    }

    const eventType =
      patch.isPublished === true
        ? "publish"
        : patch.isPublished === false
          ? "unpublish"
          : "data_change";
    try {
      await this.auditService.record({
        eventType,
        actorUserId,
        actorType: "human",
        entityType: "help_article",
        entityId: id,
        action: eventType === "data_change" ? "update" : eventType,
        afterState: { ...patch },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(
        `Help article ${id} update committed, but recording its audit event failed:`,
        error,
      );
    }

    return updated;
  }
}
