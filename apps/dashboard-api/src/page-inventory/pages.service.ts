import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  PageEntity,
  PageListFilter,
  PageRepository,
  PageWorkflowStage,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import { PAGE_REPOSITORY } from "./page-inventory.constants.js";
import type { CreatePageDto, UpdatePageDto } from "./page-inventory.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ProjectService } from "../projects/project.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { RoadmapItemsService } from "../projects/roadmap-items.service.js";

const MODULE_KEY = "page_inventory";

/** The real, seeded RBAC action (`06_Roles_and_Permissions.md`, `00013-seed-rbac-matrix.ts:118-124`)
 *  required for a given `workflowStage` transition — identical vocabulary to Service/Persona/
 *  Proof-and-Claims/Website-Strategy-Center's own. */
type PageWorkflowAction = "submit" | "review" | "approve";

/**
 * Sourced from `05_Workflow_State_Machines.md §2`'s generic artifact lifecycle, reused verbatim
 * from `ClaimsService`'s/`PersonasService`'s/`ServicesService`'s own (already code-reviewed)
 * `TRANSITIONS` table (task package D8) — a 5th occurrence of this identical shape, deliberately
 * not extracted into a shared helper (already-accepted, out-of-scope debt in this codebase).
 * `submitted`/`revision_requested`/`rejected -> draft` all require `submit` (the submitter/editor
 * drives the revise-and-resubmit loop, not the approver). `archived`/`superseded` are both
 * terminal — no code path resurrects a record from either.
 */
const TRANSITIONS: Readonly<
  Record<PageWorkflowStage, Readonly<Partial<Record<PageWorkflowStage, PageWorkflowAction>>>>
> = {
  draft: { submitted: "submit", archived: "approve" },
  submitted: { under_review: "review", draft: "submit", archived: "approve" },
  under_review: {
    approved: "approve",
    revision_requested: "review",
    rejected: "approve",
    archived: "approve",
  },
  revision_requested: { draft: "submit", submitted: "submit", archived: "approve" },
  approved: { superseded: "approve", archived: "approve" },
  rejected: { draft: "submit", archived: "approve" },
  superseded: {},
  archived: {},
};

@Injectable()
export class PagesService {
  constructor(
    @Inject(PAGE_REPOSITORY) private readonly pages: PageRepository,
    private readonly projects: ProjectService,
    private readonly roadmapItems: RoadmapItemsService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  /** Validates `roadmapPhaseId` against the real, already-existing `roadmap_items` table, scoped
   *  to the same project as the page itself, via `RoadmapItemsService.existsInProject()` — a
   *  narrow, read-only delegating method, not the write-capable `ROADMAP_ITEM_REPOSITORY` token
   *  directly (mirrors `PersonasService.assertServiceIdsExist()`'s own identical shape). Unlike
   *  `relatedServiceIds`-style fields on sibling modules, `roadmapPhaseId` is Zod-validated as
   *  `z.string().uuid()` before this ever runs, so no malformed-id guard is needed here — the DTO
   *  layer already guarantees the shape. */
  private async assertRoadmapPhaseExists(
    id: string | null | undefined,
    projectId: string,
  ): Promise<void> {
    if (!id) {
      return;
    }
    const exists = await this.roadmapItems.existsInProject(id, projectId);
    if (!exists) {
      throw new BadRequestException(`roadmapPhaseId not found: ${id}`);
    }
  }

  /** `projectId` is a route-derived parameter, not part of `CreatePageDto` (code-review finding,
   *  `module-page-inventory`) — mirrors `RoadmapItemsService.create()`'s own
   *  `(projectId, input, actorUserId)` shape. */
  async create(projectId: string, input: CreatePageDto, actorUserId: string): Promise<PageEntity> {
    // `this.projects.findById()` throws NotFoundException itself if the project doesn't exist —
    // mirrors ClaimSourcesService.create()'s own "parent not found -> 404" pattern for a
    // sub-resource whose own parent id is caller-supplied, not route-derived.
    const [existing] = await Promise.all([
      this.pages.findByPublicId(input.publicId),
      this.projects.findById(projectId),
      this.assertRoadmapPhaseExists(input.roadmapPhaseId, projectId),
    ]);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: PageEntity;
    try {
      created = await this.pages.create({ ...input, projectId, createdBy: actorUserId });
    } catch (error) {
      // The publicId uniqueness check above is TOCTOU (two concurrent creates with the same
      // publicId can both pass it before either INSERT commits) — the real unique index catches
      // the race loser, but without this catch it would otherwise surface as a raw 500 instead of
      // the same clean 400 the check above already gives the non-racing caller.
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(`publicId already in use: ${input.publicId}`);
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId: created.projectId,
      entityType: "page",
      entityId: created.id,
      action: "create",
      afterState: { pageName: created.pageName },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  /** `projectId`-scoped (IDOR prevention, code-review finding `module-page-inventory`) — a page
   *  from a different project, accessed via this project's own route, is treated as not found
   *  rather than silently returned/mutated. Mirrors `PageUrlsService.findParentPageOrThrow()`'s/
   *  `ClaimSourcesService`'s own identical pattern for a sub-resource scoped to its parent. */
  async findById(id: string, projectId: string): Promise<PageEntity> {
    const page = await this.pages.findById(id);
    if (!page || page.projectId !== projectId) {
      throw new NotFoundException(`Page not found: ${id}`);
    }
    return page;
  }

  async list(filter: PageListFilter): Promise<readonly PageEntity[]> {
    return this.pages.list(filter);
  }

  /** A narrow, read-only delegating method for another module's own cross-module existence check
   *  — mirrors `RoadmapItemsService.existsInProject()`'s own already-established shape
   *  (`apps/dashboard-api/src/projects/roadmap-items.service.ts`), not the write-capable
   *  `PAGE_REPOSITORY` token directly (this project's own standing precedent: only ever export a
   *  narrow, read-only delegating method across a module boundary, never a raw repository token —
   *  see `docs/implementation/module-persona-library.md`'s security-review section for the
   *  `SERVICE_REPOSITORY` exposure this avoids repeating). Consumed by the Keyword & Entity
   *  Library module's `PageKeywordAssignmentsService.create()` to validate a caller-supplied
   *  `pageId` (task package `module-keyword-and-entity-library.md` D1/D10). */
  async existsInProject(id: string, projectId: string): Promise<boolean> {
    const page = await this.pages.findById(id);
    return page !== null && page.projectId === projectId;
  }

  /** A narrow, read-only delegating method for another module's own org-wide existence check —
   *  mirrors `ServicesService.existingServiceIds()`'s own already-established shape, not the
   *  write-capable `PAGE_REPOSITORY` token directly. Deliberately org-wide (no project filter),
   *  unlike `existsInProject()` above — a case study can legitimately reference a page in any
   *  project. Consumed by Case Study Library's `CaseStudyLibraryService` to validate
   *  `relatedPageIds`. */
  async existingPageIds(ids: readonly string[]): Promise<ReadonlySet<string>> {
    const found = await this.pages.findByIds(ids);
    return new Set(found.map((row) => row.id));
  }

  async update(
    id: string,
    projectId: string,
    patch: UpdatePageDto,
    actorUserId: string,
  ): Promise<PageEntity> {
    // Sequential, not parallel (unlike sibling modules' own relatedServiceIds-style checks) —
    // assertRoadmapPhaseExists() needs the page's own current projectId to scope the check
    // against, a real data dependency, not an avoidable extra round trip. findById() also 404s
    // cleanly (including on a project mismatch) before anything else runs.
    const current = await this.findById(id, projectId);

    // archived/superseded are both terminal (TRANSITIONS's own entries for both are `{}` — no
    // code path resurrects a page from either) — content on a terminal row must never change
    // (code-review finding, `dashboard-web-page-inventory`: this guard was missing entirely,
    // unlike Website Strategy Center's own identical `update()` guard, which this mirrors).
    if (current.workflowStage === "archived" || current.workflowStage === "superseded") {
      throw new BadRequestException(
        `Page ${id} is ${current.workflowStage} and can no longer be edited`,
      );
    }

    await this.assertRoadmapPhaseExists(patch.roadmapPhaseId, current.projectId);

    // current.workflowStage is passed as a CAS guard (security-review finding,
    // `dashboard-web-page-inventory`: the terminal-state check above reads workflowStage into
    // application memory, but without this the actual write was still unconditional — a
    // concurrent changeWorkflowStage() transition landing between the read and this write could
    // let this edit silently succeed against what is now an archived/superseded row, the exact
    // race Website Strategy Center's own updateInPlace()/expectedApprovalStatus already closed
    // once for the identical bug class).
    const updated = await this.pages.update(
      id,
      { ...patch, updatedBy: actorUserId },
      current.workflowStage,
    );
    if (!updated) {
      // 0 affected rows means either the row is genuinely gone (no hard-delete exists for this
      // module today, but this still guards a hypothetical future one, matching every sibling
      // module's own identical belt-and-suspenders check) or — the real case the CAS guard above
      // exists for — its workflowStage changed concurrently since the read. Distinguish the two
      // with a fresh read rather than assuming either, mirroring
      // WebsiteStrategyRecordsService.update()'s own identical disambiguation.
      const stillExists = await this.pages.findById(id);
      if (!stillExists) {
        throw new NotFoundException(`Page not found: ${id}`);
      }
      throw new ConflictException(
        `Page ${id} workflow stage changed concurrently while editing — reload and retry`,
      );
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId: current.projectId,
      entityType: "page",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  async changeWorkflowStage(
    id: string,
    projectId: string,
    nextStage: PageWorkflowStage,
    actorUserId: string,
  ): Promise<PageEntity> {
    const page = await this.findById(id, projectId);
    if (page.workflowStage === nextStage) {
      return page; // no-op, not an error — re-requesting the current stage is harmless
    }

    const requiredAction = TRANSITIONS[page.workflowStage][nextStage];
    if (!requiredAction) {
      throw new BadRequestException(
        `Invalid page workflow stage transition: ${page.workflowStage} -> ${nextStage}`,
      );
    }
    // `page.projectId` (== the already-verified `projectId` param) is threaded into the dynamic
    // per-transition check (code-review finding, `module-page-inventory`) — without it, a caller
    // holding only a project-scoped `page_inventory` grant (not a global one) was denied on every
    // workflow-stage transition, the exact gap this fix closes.
    await this.authorizationService.assertAllowed(
      actorUserId,
      MODULE_KEY,
      requiredAction,
      page.projectId,
    );

    const result = await this.pages.updateStatus(id, page.workflowStage, nextStage, actorUserId);
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Page not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Page ${id} workflow stage changed concurrently ` +
          `(expected ${page.workflowStage}, now ${result.entity.workflowStage}) — reload and retry`,
      );
    }

    // A failed audit write here is caught and only console.error'd, not retried or alerted on —
    // the byte-identical, already-accepted pattern ClaimsService.changeApprovalStatus()/
    // PersonasService.changeApprovalStatus()/ServicesService.changeApprovalStatus() all have.
    const isApproval = nextStage === "approved";
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        projectId: page.projectId,
        entityType: "page",
        entityId: id,
        action: `status:${page.workflowStage}->${nextStage}`,
        beforeState: { workflowStage: page.workflowStage },
        afterState: { workflowStage: nextStage },
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Page ${id} workflow stage transition ${page.workflowStage}->${nextStage} committed, ` +
          "but recording its audit event failed:",
        error,
      );
    }

    return result.entity;
  }
}
