import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  InternalLinkEntity,
  InternalLinkListFilter,
  InternalLinkRepository,
  InternalLinkStatus,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import { INTERNAL_LINK_REPOSITORY } from "./internal-linking-library.constants.js";
import type {
  CreateInternalLinkDto,
  UpdateInternalLinkDto,
} from "./internal-linking-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ProjectService } from "../projects/project.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { PagesService } from "../page-inventory/pages.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { UsersService } from "../users/users.service.js";

/** The RBAC group key (`06_Roles_and_Permissions.md`, `00013-seed-rbac-matrix.ts:190-198`) —
 *  distinct from `module_registry.key = "internal_linking_library"`. The IDENTICAL string
 *  Keyword & Entity Library's own services already use — both modules were seeded to share this
 *  RBAC group (task package §4), not a coincidence. */
const MODULE_KEY = "keyword_internal_links";

/** The real, seeded RBAC action required for a given `status` transition. */
type InternalLinkWorkflowAction = "submit" | "review" | "approve";

/**
 * A genuinely bespoke transition table (task package D2) — NOT any prior module's 8-value
 * `TRANSITIONS` table, since the states themselves differ entirely:
 *   - `proposed -> approved`: requires `approve`.
 *   - `approved -> implemented`: requires `submit` (the editor who actually places the link).
 *   - `implemented -> verified`: requires `review` (QA/security reviewer confirms it's live and
 *     correct).
 *   - One backward step from each non-initial state: `approved -> proposed` (`approve`, only an
 *     approver should be able to un-approve their own decision), `implemented -> approved`
 *     (`submit`, the editor's own undo), `verified -> implemented` (`review`, the same role that
 *     verified it in the first place).
 * No terminal state exists in this pass (task package D2) — every state has at least one valid
 * outbound transition.
 */
const TRANSITIONS: Readonly<
  Record<InternalLinkStatus, Readonly<Partial<Record<InternalLinkStatus, InternalLinkWorkflowAction>>>>
> = {
  proposed: { approved: "approve" },
  approved: { implemented: "submit", proposed: "approve" },
  implemented: { verified: "review", approved: "submit" },
  verified: { implemented: "review" },
};

@Injectable()
export class InternalLinksService {
  constructor(
    @Inject(INTERNAL_LINK_REPOSITORY) private readonly links: InternalLinkRepository,
    private readonly projects: ProjectService,
    private readonly pages: PagesService,
    private readonly usersService: UsersService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  /** Existence-validated via `UsersService.findById()` (task package D7), mirroring
   *  `ProjectService.assertOwnerExists()`'s own precedent exactly — a clean 400, not a raw
   *  FK-violation 500. */
  private async assertApproverExists(assignedApproverUserId: string): Promise<void> {
    try {
      await this.usersService.findById(assignedApproverUserId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException(
          `assignedApproverUserId does not resolve to an active user: ${assignedApproverUserId}`,
        );
      }
      throw error;
    }
  }

  /** `projectId` is a route-derived parameter, not part of `CreateInternalLinkDto` (mirrors
   *  `PagesService.create()`'s/`KeywordsService.create()`'s own `(projectId, input, actorUserId)`
   *  shape). */
  async create(
    projectId: string,
    input: CreateInternalLinkDto,
    actorUserId: string,
  ): Promise<InternalLinkEntity> {
    // A page cannot link to itself — checked before any database call, no need to wait on the
    // page-existence checks below (task package D4).
    if (input.sourcePageId === input.targetPageId) {
      throw new BadRequestException("sourcePageId and targetPageId must not be the same page");
    }

    // Every check below shares the already-known projectId with no dependency on any other
    // check's result, so they all run via Promise.all — mirrors PageKeywordAssignmentsService's/
    // PersonasService's own already-fixed pattern for this exact bug class (a first version
    // elsewhere in this codebase ran independent checks sequentially, an unnecessary extra round
    // trip; code review caught it once already, don't reintroduce it here). No malformed-UUID
    // guard is needed before existsInProject()/findById() — sourcePageId/targetPageId/
    // assignedApproverUserId are all already `z.string().uuid()`-validated by the DTO before this
    // method ever runs.
    const checks: Array<Promise<unknown>> = [
      this.links.findByPublicId(input.publicId),
      this.projects.findById(projectId),
      this.pages.existsInProject(input.sourcePageId, projectId).then((exists) => {
        if (!exists) {
          throw new BadRequestException(`sourcePageId not found: ${input.sourcePageId}`);
        }
      }),
      this.pages.existsInProject(input.targetPageId, projectId).then((exists) => {
        if (!exists) {
          throw new BadRequestException(`targetPageId not found: ${input.targetPageId}`);
        }
      }),
    ];
    if (input.assignedApproverUserId) {
      checks.push(this.assertApproverExists(input.assignedApproverUserId));
    }

    const [existing] = await Promise.all(checks);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: InternalLinkEntity;
    try {
      created = await this.links.create({
        ...input,
        projectId,
        createdBy: actorUserId,
      });
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
      entityType: "internal_link",
      entityId: created.id,
      action: "create",
      afterState: { sourcePageId: created.sourcePageId, targetPageId: created.targetPageId },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  /** `projectId`-scoped (IDOR prevention, mirrors `KeywordsService.findById()`'s own identical
   *  check) — a link from a different project, accessed via this project's own route, is treated
   *  as not found rather than silently returned/mutated. */
  async findById(id: string, projectId: string): Promise<InternalLinkEntity> {
    const link = await this.links.findById(id);
    if (!link || link.projectId !== projectId) {
      throw new NotFoundException(`Internal link not found: ${id}`);
    }
    return link;
  }

  async list(filter: InternalLinkListFilter): Promise<readonly InternalLinkEntity[]> {
    return this.links.list(filter);
  }

  async update(
    id: string,
    projectId: string,
    patch: UpdateInternalLinkDto,
    actorUserId: string,
  ): Promise<InternalLinkEntity> {
    const current = await this.findById(id, projectId);

    // This module's chosen 4-state workflow has no terminal state (task package D2) — every state
    // has at least one valid outbound transition, so unlike Keyword & Entity Library/Page
    // Inventory there is no "content on a terminal row must never change" guard to add here.

    const nextSourcePageId = patch.sourcePageId ?? current.sourcePageId;
    const nextTargetPageId = patch.targetPageId ?? current.targetPageId;
    if (nextSourcePageId === nextTargetPageId) {
      throw new BadRequestException("sourcePageId and targetPageId must not be the same page");
    }

    // Only re-validate a page/approver id that's actually changing from its current value —
    // mirrors PersonasService.update()'s own `relatedServiceIds` "only re-validate on change"
    // pattern; re-checking an unchanged value is both unnecessary and, for a since-removed
    // approver, would incorrectly block an edit that doesn't touch that field at all.
    const checks: Array<Promise<void>> = [];
    if (patch.sourcePageId && patch.sourcePageId !== current.sourcePageId) {
      checks.push(
        this.pages.existsInProject(patch.sourcePageId, projectId).then((exists) => {
          if (!exists) {
            throw new BadRequestException(`sourcePageId not found: ${patch.sourcePageId}`);
          }
        }),
      );
    }
    if (patch.targetPageId && patch.targetPageId !== current.targetPageId) {
      checks.push(
        this.pages.existsInProject(patch.targetPageId, projectId).then((exists) => {
          if (!exists) {
            throw new BadRequestException(`targetPageId not found: ${patch.targetPageId}`);
          }
        }),
      );
    }
    if (
      patch.assignedApproverUserId &&
      patch.assignedApproverUserId !== current.assignedApproverUserId
    ) {
      checks.push(this.assertApproverExists(patch.assignedApproverUserId));
    }
    if (checks.length > 0) {
      await Promise.all(checks);
    }

    // current.status is passed as a CAS guard — without it, a concurrent changeStatus()
    // transition landing between the read above and this write could let this edit silently
    // succeed against what is now a different status than the caller saw, the exact race Page
    // Inventory's/Keyword & Entity Library's own update() already closed once for the identical
    // bug class.
    const updated = await this.links.update(
      id,
      { ...patch, updatedBy: actorUserId },
      current.status,
    );
    if (!updated) {
      // 0 affected rows means either the row is genuinely gone, or — the real case the CAS guard
      // above exists for — its status changed concurrently since the read. Disambiguate with a
      // fresh read rather than assuming either, mirroring KeywordsService.update()'s own identical
      // disambiguation.
      const stillExists = await this.links.findById(id);
      if (!stillExists) {
        throw new NotFoundException(`Internal link not found: ${id}`);
      }
      throw new ConflictException(
        `Internal link ${id} status changed concurrently while editing — reload and retry`,
      );
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId: current.projectId,
      entityType: "internal_link",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  async changeStatus(
    id: string,
    projectId: string,
    nextStatus: InternalLinkStatus,
    actorUserId: string,
  ): Promise<InternalLinkEntity> {
    const link = await this.findById(id, projectId);
    if (link.status === nextStatus) {
      return link; // no-op, not an error — re-requesting the current status is harmless
    }

    const requiredAction = TRANSITIONS[link.status][nextStatus];
    if (!requiredAction) {
      throw new BadRequestException(
        `Invalid internal link status transition: ${link.status} -> ${nextStatus}`,
      );
    }
    // `link.projectId` (== the already-verified `projectId` param) is threaded into the dynamic
    // per-transition check — mirrors KeywordsService.changeApprovalStatus()'s/
    // PagesService.changeWorkflowStage()'s own fix for the identical gap: without it, a caller
    // holding only a project-scoped `keyword_internal_links` grant (not a global one) would be
    // denied on every transition.
    await this.authorizationService.assertAllowed(
      actorUserId,
      MODULE_KEY,
      requiredAction,
      link.projectId,
    );

    const result = await this.links.updateStatus(id, link.status, nextStatus, actorUserId);
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Internal link not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Internal link ${id} status changed concurrently ` +
          `(expected ${link.status}, now ${result.entity.status}) — reload and retry`,
      );
    }

    // A failed audit write here is caught and only console.error'd, not retried or alerted on —
    // the byte-identical, already-accepted pattern KeywordsService.changeApprovalStatus()/
    // PagesService.changeWorkflowStage()/ClaimsService.changeApprovalStatus() all have.
    const isApproval = nextStatus === "approved";
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        projectId: link.projectId,
        entityType: "internal_link",
        entityId: id,
        action: `status:${link.status}->${nextStatus}`,
        beforeState: { status: link.status },
        afterState: { status: nextStatus },
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Internal link ${id} status transition ${link.status}->${nextStatus} committed, ` +
          "but recording its audit event failed:",
        error,
      );
    }

    return result.entity;
  }
}
