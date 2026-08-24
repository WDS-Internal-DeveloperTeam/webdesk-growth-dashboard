import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  PageKeywordAssignmentEntity,
  PageKeywordAssignmentRepository,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import { PAGE_KEYWORD_ASSIGNMENT_REPOSITORY } from "./keyword-and-entity-library.constants.js";
import type { CreatePageKeywordAssignmentDto } from "./keyword-and-entity-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { KeywordsService } from "./keywords.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { PagesService } from "../page-inventory/pages.service.js";

/**
 * Keyword <-> page assignment CRUD — a genuine join into Page Inventory's own `pages` table, no
 * content fields to edit in place beyond `assignmentNote` (carried on create only), only
 * create/list/remove (task package D1). Gated on `edit` at the module-permission level, no
 * separate approval workflow (task package D9). `PagesService.existsInProject()` is the narrow,
 * read-only cross-module delegating method this validates `pageId` against (task package D10) —
 * not the write-capable `PAGE_REPOSITORY` token directly.
 */
@Injectable()
export class PageKeywordAssignmentsService {
  constructor(
    @Inject(PAGE_KEYWORD_ASSIGNMENT_REPOSITORY)
    private readonly assignments: PageKeywordAssignmentRepository,
    private readonly keywords: KeywordsService,
    private readonly pages: PagesService,
    private readonly auditService: AuditService,
  ) {}

  /** Verifies the parent keyword exists AND belongs to the given `projectId` (IDOR prevention),
   *  and that `pageId` resolves to a real Page Inventory page in the SAME project (cross-module
   *  existence validation, task package D1/D10). Both checks share the already-known `projectId`
   *  with no dependency on each other's result, so they run via `Promise.all` — mirroring
   *  `PersonasService.create()`'s own identical fix for this exact bug class (code-review finding,
   *  `module-keyword-and-entity-library`: a first version of this method ran them sequentially, an
   *  unnecessary extra round trip). No malformed-`pageId` guard is needed before
   *  `existsInProject()` — unlike Persona Library's `relatedServiceIds` (a plain, unvalidated
   *  array), `pageId` is already `z.string().uuid()`-validated by `ZodValidationPipe` before this
   *  method ever runs (code-review finding: an earlier version of this guard could never actually
   *  fire on the real HTTP path). */
  async create(
    keywordId: string,
    projectId: string,
    input: CreatePageKeywordAssignmentDto,
    actorUserId: string,
  ): Promise<PageKeywordAssignmentEntity> {
    const [keyword, pageExists] = await Promise.all([
      this.keywords.findById(keywordId, projectId),
      this.pages.existsInProject(input.pageId, projectId),
    ]);
    if (!pageExists) {
      throw new BadRequestException(`pageId not found: ${input.pageId}`);
    }

    let created: PageKeywordAssignmentEntity;
    try {
      created = await this.assignments.create({
        keywordId,
        pageId: input.pageId,
        assignmentNote: input.assignmentNote,
        createdBy: actorUserId,
      });
    } catch (error) {
      // page_keyword_assignments_unique is a real unique index (migration 00060) — a duplicate
      // assignment submission is caught here, not left as a raw 500.
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(
          `This page is already assigned to this keyword: ${input.pageId}`,
        );
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId: keyword.projectId,
      entityType: "page_keyword_assignment",
      entityId: created.id,
      action: "create",
      afterState: { keywordId, pageId: input.pageId },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  /** `projectId`-scoped (IDOR prevention) via `KeywordsService.findById()`. */
  async listForKeyword(
    keywordId: string,
    projectId: string,
  ): Promise<readonly PageKeywordAssignmentEntity[]> {
    await this.keywords.findById(keywordId, projectId);
    return this.assignments.listForKeyword(keywordId);
  }

  /** `keywordId`-scoped (IDOR prevention), same as create's parent check. */
  async remove(
    id: string,
    keywordId: string,
    projectId: string,
    actorUserId: string,
  ): Promise<void> {
    const keyword = await this.keywords.findById(keywordId, projectId);

    const removed = await this.assignments.remove(id, keywordId);
    if (!removed) {
      throw new NotFoundException(`Page-keyword assignment not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId: keyword.projectId,
      entityType: "page_keyword_assignment",
      entityId: id,
      action: "delete",
      beforeState: { keywordId },
      retentionCategory: "audit-7y",
    });
  }
}
