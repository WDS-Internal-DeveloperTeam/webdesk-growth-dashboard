import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { withTransaction } from "@webdesk/database";
import { sanitizeNullableRichText } from "@webdesk/validation";
import type {
  DesignReviewCasResult,
  DesignReviewDecisionEntity,
  DesignReviewDecisionRepository,
  DesignReviewEntity,
  DesignReviewRepository,
  DesignReviewStatus,
} from "@webdesk/database";
import {
  DESIGN_REVIEW_CENTER_MODULE_KEY,
  DESIGN_REVIEW_DECISION_REPOSITORY,
  DESIGN_REVIEW_REPOSITORY,
} from "./design-review-center.constants.js";
import type {
  CreateDesignReviewDto,
  DecideDesignReviewDto,
  ListDesignReviewsQueryDto,
} from "./design-review-center.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { SeparationOfDutiesService } from "../auth/common/separation-of-duties.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { UsersService } from "../users/users.service.js";

/** The real, seeded RBAC action required to submit `decide()`'s requested `action` (the shared
 *  `review_center` group, `06_Roles_and_Permissions.md`/`00013-seed-rbac-matrix.ts:208-215`) —
 *  `approve`/`approve_with_notes`/`reject` all require `approve`; `request_revision` requires only
 *  `review` (the weaker action every mid-tier role already holds, letting a reviewer send work
 *  back for revision without also holding the ability to formally approve/reject it). Mirrors
 *  `ReviewsService`'s own `REQUIRED_ACTION_FOR_DECISION` exactly. */
const REQUIRED_ACTION_FOR_DECISION: Readonly<
  Record<DecideDesignReviewDto["action"], "approve" | "review">
> = {
  approve: "approve",
  approve_with_notes: "approve",
  reject: "approve",
  request_revision: "review",
};

/** The `status` transition each `decide()` action produces (D3) — `approve`/`approve_with_notes`
 *  are the SAME transition (`-> approved`); the distinction lives entirely on the
 *  `design_review_decisions` row's own `action`, never as two separate statuses. `supersede` is
 *  deliberately absent — it is never a `decide()`-produced transition for the review it's called
 *  on; it is the automatic side effect this method triggers on a DIFFERENT review. */
const NEXT_STATUS_FOR_DECISION: Readonly<
  Record<DecideDesignReviewDto["action"], DesignReviewStatus>
> = {
  approve: "approved",
  approve_with_notes: "approved",
  reject: "rejected",
  request_revision: "revision_requested",
};

@Injectable()
export class DesignReviewsService {
  constructor(
    @Inject(DESIGN_REVIEW_REPOSITORY) private readonly designReviews: DesignReviewRepository,
    @Inject(DESIGN_REVIEW_DECISION_REPOSITORY)
    private readonly designReviewDecisions: DesignReviewDecisionRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly separationOfDuties: SeparationOfDutiesService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Resolves a `DesignReviewCasResult` into its entity or throws the matching HTTP exception — mirrors
   * `ReviewsService.unwrapCasResult()`'s own already-reviewed extraction.
   */
  private unwrapCasResult(
    id: string,
    result: DesignReviewCasResult<DesignReviewEntity>,
    conflictMessage: (entity: DesignReviewEntity) => string,
  ): DesignReviewEntity {
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Design review not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(conflictMessage(result.entity));
    }
    return result.entity;
  }

  async create(input: CreateDesignReviewDto, actorUserId: string): Promise<DesignReviewEntity> {
    // targetModuleKey validated against the real module registry (D9) — targetId existence is
    // deliberately NOT checked, since no generic cross-module lookup capability exists to
    // validate it against. Both checks are independent DB-backed lookups, so they run
    // concurrently, mirroring ReviewsService.create()'s own already-reviewed fix.
    const [isValidTargetModule] = await Promise.all([
      this.authorizationService.isValidModuleKey(input.targetModuleKey),
      input.assignedToUserId
        ? this.usersService.assertUserExists(input.assignedToUserId, "assignedToUserId")
        : Promise.resolve(),
    ]);
    if (!isValidTargetModule) {
      throw new BadRequestException(
        `targetModuleKey does not resolve to a real module: ${input.targetModuleKey}`,
      );
    }

    const created = await this.designReviews.create({
      targetModuleKey: input.targetModuleKey,
      targetId: input.targetId,
      targetLabel: input.targetLabel ?? null,
      reviewType: input.reviewType,
      submittedByUserId: actorUserId,
      assignedToUserId: input.assignedToUserId ?? null,
      versionALabel: input.versionALabel ?? null,
      versionBLabel: input.versionBLabel ?? null,
    });

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "design_review",
      entityId: created.id,
      action: "create",
      afterState: {
        targetModuleKey: created.targetModuleKey,
        targetId: created.targetId,
        reviewType: created.reviewType,
      },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async findById(id: string): Promise<DesignReviewEntity> {
    const review = await this.designReviews.findById(id);
    if (!review) {
      throw new NotFoundException(`Design review not found: ${id}`);
    }
    return review;
  }

  /** `?assignedToMe=true` is resolved here, not in the repository, to the caller's own
   *  `actorUserId` — mirrors `ReviewsService.list()`'s own established pattern. */
  async list(
    query: ListDesignReviewsQueryDto,
    actorUserId: string,
  ): Promise<readonly DesignReviewEntity[]> {
    return this.designReviews.list({
      status: query.status,
      targetModuleKey: query.targetModuleKey,
      reviewType: query.reviewType,
      assignedToUserId: query.assignedToMe ? actorUserId : undefined,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });
  }

  /** This module's own queryable local history — a review's `design_review_decisions` rows, most
   *  recent first, including any `supersede` row the automatic side effect wrote for it. Gated on
   *  `view`, the same action `findById()`/`list()` use — reading a review's decision trail carries
   *  no more privilege than reading the review itself. */
  async listDecisions(id: string): Promise<readonly DesignReviewDecisionEntity[]> {
    await this.findById(id);
    return this.designReviewDecisions.listByReview(id);
  }

  /**
   * One method handling all 4 approval-shaped actions (`approve`/`approve_with_notes`/`reject`/
   * `request_revision`) — an atomic compare-and-swap on the caller-supplied `expectedStatus`,
   * gated by separation of duties BEFORE the write, then mirrored into both
   * `design_review_decisions` (this module's own local history) and `audit_events`. When the
   * resulting `nextStatus` is `"approved"` (D4), the SAME transaction also atomically flips any
   * OTHER review sharing `(targetModuleKey, targetId, reviewType)` that is currently `approved` to
   * `superseded`, writing a matching `design_review_decisions` row (`action: "supersede"`,
   * `actorUserId` = the same actor who triggered the approval — there is no system/null-actor
   * convention in this codebase) for each one. The CAS write, the primary
   * `design_review_decisions` write, the supersede lookup, and every superseded row's own
   * `design_review_decisions` write are all committed atomically via `withTransaction()`, mirroring
   * `ReviewsService.decide()`'s own established transaction boundary. `audit_events` stays outside
   * the transaction and best-effort (unchanged) — the byte-identical, already-accepted pattern
   * `ReviewsService.decide()`/`ContentTemplatesService.changeApprovalStatus()`/
   * `InternalLinksService.changeStatus()` all have.
   */
  async decide(
    id: string,
    dto: DecideDesignReviewDto,
    actorUserId: string,
  ): Promise<DesignReviewEntity> {
    const review = await this.findById(id);

    // Two different RBAC actions gate this one method depending on which action is requested,
    // checked dynamically, not via a static @RequirePermission, mirroring
    // ReviewsService.decide()'s/ContentTemplatesService.changeApprovalStatus()'s own layered
    // pattern.
    await this.authorizationService.assertAllowed(
      actorUserId,
      DESIGN_REVIEW_CENTER_MODULE_KEY,
      REQUIRED_ACTION_FOR_DECISION[dto.action],
    );

    // Separation of duties — the submitter can never also be the actor deciding their own
    // submission, for any of the 4 approval-shaped actions (including request_revision — a real
    // decision, not merely an approval).
    await this.separationOfDuties.assertDistinctActors(
      actorUserId,
      review.submittedByUserId,
      "design review approver",
      { entityType: "design_review", entityId: review.id, retentionCategory: "approval-audit-7y" },
    );

    const nextStatus = NEXT_STATUS_FOR_DECISION[dto.action];
    const decidedAt = new Date();
    // "notes" is real HTML from dashboard-web's RichTextEditor whenever a UI for this module
    // exists (per the 2026-08-22 standing rule), mirroring ReviewsService.decide()'s own
    // established sanitization. Sanitized once here and reused for both the local
    // design_review_decisions write and the audit_events mirror below.
    const sanitizedNotes = sanitizeNullableRichText(dto.notes) ?? null;

    const { updated, superseded } = await withTransaction(async (transaction) => {
      const result = await this.designReviews.updateStatus(
        id,
        dto.expectedStatus,
        nextStatus,
        actorUserId,
        decidedAt,
        transaction,
      );
      const updatedEntity = this.unwrapCasResult(
        id,
        result,
        (current) =>
          `Design review ${id} status changed concurrently ` +
          `(expected ${dto.expectedStatus}, now ${current.status}) — reload and retry`,
      );

      // This module's own queryable local history — always written for a successful decide()
      // call, distinct from the audit_events mirror below.
      await this.designReviewDecisions.create(
        { reviewId: id, action: dto.action, actorUserId, notes: sanitizedNotes, decidedAt },
        transaction,
      );

      // D4 — automatic supersede, ONLY when this decision just produced "approved". Runs inside
      // the same transaction so the primary CAS write and every superseded row's own status flip
      // + decision row commit or roll back together.
      let supersededEntities: readonly DesignReviewEntity[] = [];
      if (nextStatus === "approved") {
        supersededEntities = await this.designReviews.supersedeOtherApproved(
          updatedEntity.targetModuleKey,
          updatedEntity.targetId,
          updatedEntity.reviewType,
          id,
          transaction,
        );
        for (const supersededEntity of supersededEntities) {
          await this.designReviewDecisions.create(
            {
              reviewId: supersededEntity.id,
              action: "supersede",
              actorUserId,
              decidedAt,
            },
            transaction,
          );
        }
      }

      return { updated: updatedEntity, superseded: supersededEntities };
    });

    // Every decide() action is approval-shaped — always mirrored into the real,
    // DB-trigger-enforced audit_events table. Deliberately OUTSIDE the transaction above and
    // best-effort (a failed audit write here is caught and only console.error'd, not retried or
    // alerted on) — the byte-identical, already-accepted pattern ReviewsService.decide() has.
    try {
      await this.auditService.record({
        eventType: "approval",
        actorUserId,
        actorType: "human",
        entityType: "design_review",
        entityId: id,
        action: dto.action,
        beforeState: { status: review.status },
        afterState: { status: nextStatus },
        reason: sanitizedNotes,
        retentionCategory: "approval-audit-7y",
      });
    } catch (error) {
      console.error(
        `Design review ${id} decision "${dto.action}" committed, but recording its audit event failed:`,
        error,
      );
    }

    // A separate, best-effort audit_events row for each auto-superseded record (D7) — mirrors
    // Website Strategy Center's own dual-write shape for its fork/supersede path.
    for (const supersededEntity of superseded) {
      try {
        await this.auditService.record({
          eventType: "approval",
          actorUserId,
          actorType: "human",
          entityType: "design_review",
          entityId: supersededEntity.id,
          action: "supersede",
          beforeState: { status: "approved" },
          afterState: { status: "superseded" },
          retentionCategory: "approval-audit-7y",
        });
      } catch (error) {
        console.error(
          `Design review ${supersededEntity.id} was auto-superseded, but recording its audit event failed:`,
          error,
        );
      }
    }

    return updated;
  }
}
