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
    const created = await this.articles.create({
      category: input.category,
      title: input.title,
      content: sanitizeRichTextHtml(input.content),
      isPublished: input.isPublished ?? false,
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
   * group), gated only on `edit`. `content` is re-sanitized only when the patch actually changes
   * it, mirroring `sanitizeNullableRichTextIfChanged()`'s own skip-if-unchanged optimization for a
   * field whose value is required rather than nullable.
   */
  async update(
    id: string,
    patch: UpdateHelpArticleDto,
    actorUserId: string,
  ): Promise<HelpArticleEntity> {
    const current = await this.findById(id);

    const { content: patchedContent, ...restOfPatch } = patch;
    const shouldReplaceContent = patchedContent !== undefined && patchedContent !== current.content;

    const updated = await this.articles.update(id, {
      ...restOfPatch,
      ...(shouldReplaceContent ? { content: sanitizeRichTextHtml(patchedContent) } : {}),
      updatedBy: actorUserId,
    });
    if (!updated) {
      throw new NotFoundException(`Help article not found: ${id}`);
    }

    const justPublished = patch.isPublished === true && !current.isPublished;
    const justUnpublished = patch.isPublished === false && current.isPublished;
    try {
      await this.auditService.record({
        eventType: justPublished ? "publish" : justUnpublished ? "unpublish" : "data_change",
        actorUserId,
        actorType: "human",
        entityType: "help_article",
        entityId: id,
        action: justPublished ? "publish" : justUnpublished ? "unpublish" : "update",
        afterState: { isPublished: updated.isPublished },
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
