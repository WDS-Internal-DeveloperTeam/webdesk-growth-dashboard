import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  PageEntity,
  PageRepository,
  PageUrlEntity,
  PageUrlRepository,
} from "@webdesk/database";
import { PAGE_REPOSITORY, PAGE_URL_REPOSITORY } from "./page-inventory.constants.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";

/**
 * Page-URL CRUD, scoped to a parent page — mirrors `ClaimSourcesService`'s own shape
 * (`apps/dashboard-api/src/proof-and-claims-library/claim-sources.service.ts`), the closest
 * existing precedent for a genuine sub-resource service in this codebase. `projectId` is always
 * denormalized from the parent page's own `projectId` here, never accepted from a caller (task
 * package D10) — this is what lets `page_urls_one_canonical_per_project_url` actually enforce the
 * spec's acceptance rule at the database layer. URLs aren't independently governed by the parent
 * page's own workflow-stage lifecycle — editing a URL is an `edit`-level action, same tier as
 * editing the page's own content fields, checked at the controller/route level (no dynamic
 * per-transition check needed here, unlike `PagesService.changeWorkflowStage()`).
 */
@Injectable()
export class PageUrlsService {
  constructor(
    @Inject(PAGE_URL_REPOSITORY) private readonly pageUrls: PageUrlRepository,
    @Inject(PAGE_REPOSITORY) private readonly pages: PageRepository,
    private readonly auditService: AuditService,
  ) {}

  /** Verifies the parent page exists AND belongs to the given `projectId` (IDOR prevention,
   *  code-review finding `module-page-inventory`) — a page from a different project, accessed via
   *  this project's own route, is treated as not found, same discipline as
   *  `PagesService.findById()`'s own identical check. */
  private async findParentPageOrThrow(pageId: string, projectId: string): Promise<PageEntity> {
    const page = await this.pages.findById(pageId);
    if (!page || page.projectId !== projectId) {
      throw new NotFoundException(`Page not found: ${pageId}`);
    }
    return page;
  }

  /** `page_urls.page_id` is FK-constrained (migration `00058`), but a well-formed, nonexistent
   *  `pageId` would otherwise only be caught at the database layer — surfacing as a raw, unhandled
   *  500 instead of a clean 404 (mirrors `ClaimSourcesService.create()`'s own equivalent guard for
   *  the identical reason). */
  async create(
    pageId: string,
    projectId: string,
    input: { url: string; isCanonical?: boolean },
    actorUserId: string,
  ): Promise<PageUrlEntity> {
    const page = await this.findParentPageOrThrow(pageId, projectId);

    let created: PageUrlEntity;
    try {
      created = await this.pageUrls.create({
        pageId,
        projectId: page.projectId,
        url: input.url,
        isCanonical: input.isCanonical,
      });
    } catch (error) {
      // page_urls_one_canonical_per_project_url is a real partial unique index (task package
      // D10) — a concurrent or duplicate canonical-URL submission is caught here, not left as a
      // raw 500. Checked by `.name`, not `instanceof` (ADR-0006 — dashboard-api never imports
      // sequelize directly).
      if (error instanceof Error && error.name === "SequelizeUniqueConstraintError") {
        throw new BadRequestException(
          `A canonical URL already exists for this project: ${input.url}`,
        );
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId: page.projectId,
      entityType: "page_url",
      entityId: created.id,
      action: "create",
      afterState: { pageId, url: created.url },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async findById(id: string): Promise<PageUrlEntity> {
    const url = await this.pageUrls.findById(id);
    if (!url) {
      throw new NotFoundException(`Page URL not found: ${id}`);
    }
    return url;
  }

  /** `projectId`-scoped (IDOR prevention, code-review finding `module-page-inventory`) — a page
   *  accessed via the wrong project's route 404s here too, not just on create/update/remove. */
  async listByPage(pageId: string, projectId: string): Promise<readonly PageUrlEntity[]> {
    await this.findParentPageOrThrow(pageId, projectId);
    return this.pageUrls.listByPage(pageId);
  }

  /** `pageId`-scoped (IDOR prevention) — a URL from a different page, accessed via this page's own
   *  route, is treated as not found rather than silently updated. `projectId`-scoped too, via
   *  `findParentPageOrThrow()`. */
  async update(
    id: string,
    pageId: string,
    projectId: string,
    patch: { url?: string; isCanonical?: boolean },
    actorUserId: string,
  ): Promise<PageUrlEntity> {
    const page = await this.findParentPageOrThrow(pageId, projectId);

    let updated: PageUrlEntity | null;
    try {
      updated = await this.pageUrls.update(id, pageId, patch);
    } catch (error) {
      if (error instanceof Error && error.name === "SequelizeUniqueConstraintError") {
        throw new BadRequestException(
          `A canonical URL already exists for this project: ${patch.url ?? ""}`,
        );
      }
      throw error;
    }
    if (!updated) {
      throw new NotFoundException(`Page URL not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId: page.projectId,
      entityType: "page_url",
      entityId: id,
      action: "update",
      afterState: { pageId, ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  /** `pageId`-scoped (IDOR prevention), same as `update()`. `projectId`-scoped too, via
   *  `findParentPageOrThrow()`. */
  async remove(id: string, pageId: string, projectId: string, actorUserId: string): Promise<void> {
    const page = await this.findParentPageOrThrow(pageId, projectId);
    const url = await this.findById(id);
    if (url.pageId !== pageId) {
      throw new NotFoundException(`Page URL not found: ${id}`);
    }

    const removed = await this.pageUrls.remove(id, pageId);
    if (!removed) {
      throw new NotFoundException(`Page URL not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId: page.projectId,
      entityType: "page_url",
      entityId: id,
      action: "delete",
      beforeState: { pageId, url: url.url },
      retentionCategory: "audit-7y",
    });
  }
}
