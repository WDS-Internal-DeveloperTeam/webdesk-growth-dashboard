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

  async create(input: CreatePageDto, actorUserId: string): Promise<PageEntity> {
    // `this.projects.findById()` throws NotFoundException itself if the project doesn't exist —
    // mirrors ClaimSourcesService.create()'s own "parent not found -> 404" pattern for a
    // sub-resource whose own parent id is caller-supplied, not route-derived.
    const [existing] = await Promise.all([
      this.pages.findByPublicId(input.publicId),
      this.projects.findById(input.projectId),
      this.assertRoadmapPhaseExists(input.roadmapPhaseId, input.projectId),
    ]);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: PageEntity;
    try {
      created = await this.pages.create({ ...input, createdBy: actorUserId });
    } catch (error) {
      // The publicId uniqueness check above is TOCTOU (two concurrent creates with the same
      // publicId can both pass it before either INSERT commits) — the real unique index catches
      // the race loser, but without this catch it would otherwise surface as a raw 500 instead of
      // the same clean 400 the check above already gives the non-racing caller. Checked by
      // `.name`, not `instanceof`, since `dashboard-api` never imports `sequelize` directly
      // (ADR-0006/`only-database-package-touches-sequelize` — only `packages/database` may) —
      // `SequelizeUniqueConstraintError` is the fixed, documented name Sequelize's own
      // `UniqueConstraintError` class always carries.
      if (error instanceof Error && error.name === "SequelizeUniqueConstraintError") {
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

  async findById(id: string): Promise<PageEntity> {
    const page = await this.pages.findById(id);
    if (!page) {
      throw new NotFoundException(`Page not found: ${id}`);
    }
    return page;
  }

  async list(filter: PageListFilter): Promise<readonly PageEntity[]> {
    return this.pages.list(filter);
  }

  async update(id: string, patch: UpdatePageDto, actorUserId: string): Promise<PageEntity> {
    // Sequential, not parallel (unlike sibling modules' own relatedServiceIds-style checks) —
    // assertRoadmapPhaseExists() needs the page's own current projectId to scope the check
    // against, a real data dependency, not an avoidable extra round trip. findById() also 404s
    // cleanly before anything else runs.
    const current = await this.findById(id);
    await this.assertRoadmapPhaseExists(patch.roadmapPhaseId, current.projectId);

    const updated = await this.pages.update(id, { ...patch, updatedBy: actorUserId });
    // A real TOCTOU-safety net, not dead code — this module has no hard-delete today, but this
    // still guards a hypothetical future one, matching every sibling module's own identical
    // belt-and-suspenders check after its own pre-fetch.
    if (!updated) {
      throw new NotFoundException(`Page not found: ${id}`);
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
    nextStage: PageWorkflowStage,
    actorUserId: string,
  ): Promise<PageEntity> {
    const page = await this.findById(id);
    if (page.workflowStage === nextStage) {
      return page; // no-op, not an error — re-requesting the current stage is harmless
    }

    const requiredAction = TRANSITIONS[page.workflowStage][nextStage];
    if (!requiredAction) {
      throw new BadRequestException(
        `Invalid page workflow stage transition: ${page.workflowStage} -> ${nextStage}`,
      );
    }
    await this.authorizationService.assertAllowed(actorUserId, MODULE_KEY, requiredAction);

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
