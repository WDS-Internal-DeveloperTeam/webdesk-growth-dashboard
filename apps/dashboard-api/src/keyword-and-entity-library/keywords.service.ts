import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  KeywordApprovalStatus,
  KeywordEntity,
  KeywordListFilter,
  KeywordRepository,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import { KEYWORD_REPOSITORY } from "./keyword-and-entity-library.constants.js";
import type { CreateKeywordDto, UpdateKeywordDto } from "./keyword-and-entity-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ProjectService } from "../projects/project.service.js";

/** The RBAC group key (`06_Roles_and_Permissions.md`, `00013-seed-rbac-matrix.ts:190-198`) —
 *  distinct from `module_registry.key = "keyword_and_entity_library"`, the same split precedent
 *  Service/Persona/Proof-and-Claims Library established between their shared `service_persona_proof`
 *  RBAC group and their own individual module-registry keys (task package §4). */
const MODULE_KEY = "keyword_internal_links";

/** The real, seeded RBAC action required for a given `approvalStatus` transition — identical
 *  vocabulary to Service/Persona/Proof-and-Claims/Website-Strategy-Center/Page-Inventory's own. */
type KeywordWorkflowAction = "submit" | "review" | "approve";

/**
 * Sourced from `05_Workflow_State_Machines.md §2`'s generic artifact lifecycle, reused verbatim
 * from `PagesService`'s/`ClaimsService`'s/`PersonasService`'s/`ServicesService`'s own (already
 * code-reviewed) `TRANSITIONS` table (task package D9) — a 6th occurrence of this identical shape,
 * deliberately not extracted into a shared helper (already-accepted, out-of-scope debt in this
 * codebase). `submitted`/`revision_requested`/`rejected -> draft` all require `submit` (the
 * submitter/editor drives the revise-and-resubmit loop, not the approver). `archived`/`superseded`
 * are both terminal — no code path resurrects a record from either.
 */
const TRANSITIONS: Readonly<
  Record<
    KeywordApprovalStatus,
    Readonly<Partial<Record<KeywordApprovalStatus, KeywordWorkflowAction>>>
  >
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
export class KeywordsService {
  constructor(
    @Inject(KEYWORD_REPOSITORY) private readonly keywords: KeywordRepository,
    private readonly projects: ProjectService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  /** `projectId` is a route-derived parameter, not part of `CreateKeywordDto` (mirrors
   *  `PagesService.create()`'s own `(projectId, input, actorUserId)` shape). */
  async create(
    projectId: string,
    input: CreateKeywordDto,
    actorUserId: string,
  ): Promise<KeywordEntity> {
    // `this.projects.findById()` throws NotFoundException itself if the project doesn't exist —
    // mirrors PagesService.create()'s own identical pattern.
    const [existing] = await Promise.all([
      this.keywords.findByPublicId(input.publicId),
      this.projects.findById(projectId),
    ]);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: KeywordEntity;
    try {
      created = await this.keywords.create({ ...input, projectId, createdBy: actorUserId });
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
      entityType: "keyword",
      entityId: created.id,
      action: "create",
      afterState: { queryText: created.queryText },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  /** `projectId`-scoped (IDOR prevention, mirrors `PagesService.findById()`'s own identical
   *  check) — a keyword from a different project, accessed via this project's own route, is
   *  treated as not found rather than silently returned/mutated. */
  async findById(id: string, projectId: string): Promise<KeywordEntity> {
    const keyword = await this.keywords.findById(id);
    if (!keyword || keyword.projectId !== projectId) {
      throw new NotFoundException(`Keyword not found: ${id}`);
    }
    return keyword;
  }

  async list(filter: KeywordListFilter): Promise<readonly KeywordEntity[]> {
    return this.keywords.list(filter);
  }

  async update(
    id: string,
    projectId: string,
    patch: UpdateKeywordDto,
    actorUserId: string,
  ): Promise<KeywordEntity> {
    const current = await this.findById(id, projectId);

    // archived/superseded are both terminal (TRANSITIONS's own entries for both are `{}` — no
    // code path resurrects a keyword from either) — content on a terminal row must never change,
    // mirroring PagesService.update()'s own identical guard (built into this module from day one,
    // not added after the fact).
    if (current.approvalStatus === "archived" || current.approvalStatus === "superseded") {
      throw new BadRequestException(
        `Keyword ${id} is ${current.approvalStatus} and can no longer be edited`,
      );
    }

    // current.approvalStatus is passed as a CAS guard — without it, a concurrent
    // changeApprovalStatus() transition landing between the read above and this write could let
    // this edit silently succeed against what is now an archived/superseded row, the exact race
    // Page Inventory's own PagesService.update()/PageRepository.update() already closed once for
    // the identical bug class.
    const updated = await this.keywords.update(
      id,
      { ...patch, updatedBy: actorUserId },
      current.approvalStatus,
    );
    if (!updated) {
      // 0 affected rows means either the row is genuinely gone, or — the real case the CAS guard
      // above exists for — its approvalStatus changed concurrently since the read. Disambiguate
      // with a fresh read rather than assuming either, mirroring PagesService.update()'s own
      // identical disambiguation.
      const stillExists = await this.keywords.findById(id);
      if (!stillExists) {
        throw new NotFoundException(`Keyword not found: ${id}`);
      }
      throw new ConflictException(
        `Keyword ${id} approval status changed concurrently while editing — reload and retry`,
      );
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId: current.projectId,
      entityType: "keyword",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  async changeApprovalStatus(
    id: string,
    projectId: string,
    nextStatus: KeywordApprovalStatus,
    actorUserId: string,
  ): Promise<KeywordEntity> {
    const keyword = await this.findById(id, projectId);
    if (keyword.approvalStatus === nextStatus) {
      return keyword; // no-op, not an error — re-requesting the current status is harmless
    }

    const requiredAction = TRANSITIONS[keyword.approvalStatus][nextStatus];
    if (!requiredAction) {
      throw new BadRequestException(
        `Invalid keyword approval status transition: ${keyword.approvalStatus} -> ${nextStatus}`,
      );
    }
    // `keyword.projectId` (== the already-verified `projectId` param) is threaded into the
    // dynamic per-transition check — mirrors PagesService.changeWorkflowStage()'s own fix for the
    // identical gap: without it, a caller holding only a project-scoped `keyword_internal_links`
    // grant (not a global one) would be denied on every transition.
    await this.authorizationService.assertAllowed(
      actorUserId,
      MODULE_KEY,
      requiredAction,
      keyword.projectId,
    );

    const result = await this.keywords.updateStatus(
      id,
      keyword.approvalStatus,
      nextStatus,
      actorUserId,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Keyword not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Keyword ${id} approval status changed concurrently ` +
          `(expected ${keyword.approvalStatus}, now ${result.entity.approvalStatus}) — reload and retry`,
      );
    }

    // A failed audit write here is caught and only console.error'd, not retried or alerted on —
    // the byte-identical, already-accepted pattern PagesService.changeWorkflowStage()/
    // ClaimsService.changeApprovalStatus()/PersonasService.changeApprovalStatus() all have.
    const isApproval = nextStatus === "approved";
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        projectId: keyword.projectId,
        entityType: "keyword",
        entityId: id,
        action: `status:${keyword.approvalStatus}->${nextStatus}`,
        beforeState: { approvalStatus: keyword.approvalStatus },
        afterState: { approvalStatus: nextStatus },
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Keyword ${id} approval status transition ${keyword.approvalStatus}->${nextStatus} ` +
          "committed, but recording its audit event failed:",
        error,
      );
    }

    return result.entity;
  }
}
