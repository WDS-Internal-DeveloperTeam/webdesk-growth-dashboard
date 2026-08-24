import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ReviewDecisionRepository,
  ReviewEntity,
  ReviewRepository,
  ReviewStatus,
} from "@webdesk/database";
import {
  REVIEW_AND_APPROVAL_CENTER_MODULE_KEY,
  REVIEW_DECISION_REPOSITORY,
  REVIEW_REPOSITORY,
} from "./review-and-approval-center.constants.js";
import type {
  CreateReviewDto,
  DecideReviewDto,
  DelegateReviewDto,
  ListReviewsQueryDto,
  SetReviewPausedDto,
} from "./review-and-approval-center.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { SeparationOfDutiesService } from "../auth/common/separation-of-duties.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { UsersService } from "../users/users.service.js";

/** The real, seeded RBAC action required to submit `decide()`'s requested `action` (task package
 *  D10, `06_Roles_and_Permissions.md`/`00013-seed-rbac-matrix.ts:208-215`'s `review_center` group)
 *  — `approve`/`approve_with_notes`/`reject` all require `approve`; `request_revision` requires
 *  only `review` (the weaker action every mid-tier role already holds, letting a reviewer send
 *  work back for revision without also holding the ability to formally approve/reject it). */
const REQUIRED_ACTION_FOR_DECISION: Readonly<
  Record<DecideReviewDto["action"], "approve" | "review">
> = {
  approve: "approve",
  approve_with_notes: "approve",
  reject: "approve",
  request_revision: "review",
};

/** The `status` transition each `decide()` action produces (task package D2) — `approve`/
 *  `approve_with_notes` are the SAME transition (`-> approved`); the distinction lives entirely on
 *  the `review_decisions` row's own `action`, never as two separate statuses. */
const NEXT_STATUS_FOR_DECISION: Readonly<Record<DecideReviewDto["action"], ReviewStatus>> = {
  approve: "approved",
  approve_with_notes: "approved",
  reject: "rejected",
  request_revision: "revision_requested",
};

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(REVIEW_REPOSITORY) private readonly reviews: ReviewRepository,
    @Inject(REVIEW_DECISION_REPOSITORY) private readonly reviewDecisions: ReviewDecisionRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly separationOfDuties: SeparationOfDutiesService,
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  /** Existence-validated via `UsersService.findById()` (mirrors
   *  `InternalLinksService.assertApproverExists()`'s/`ProjectService.assertOwnerExists()`'s own
   *  precedent exactly) — a clean 400, not a raw FK-violation 500 (`reviews.assigned_to_user_id`
   *  is a real, FK-constrained column, unlike `target_module_key`/`target_id`). */
  private async assertAssigneeExists(assignedToUserId: string): Promise<void> {
    try {
      await this.usersService.findById(assignedToUserId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException(
          `assignedToUserId does not resolve to an active user: ${assignedToUserId}`,
        );
      }
      throw error;
    }
  }

  async create(input: CreateReviewDto, actorUserId: string): Promise<ReviewEntity> {
    // targetModuleKey validated against the real module registry (task package D6) — targetId
    // existence is deliberately NOT checked, since no generic cross-module lookup capability
    // exists to validate it against.
    const isValidTargetModule = await this.authorizationService.isValidModuleKey(
      input.targetModuleKey,
    );
    if (!isValidTargetModule) {
      throw new BadRequestException(
        `targetModuleKey does not resolve to a real module: ${input.targetModuleKey}`,
      );
    }

    if (input.assignedToUserId) {
      await this.assertAssigneeExists(input.assignedToUserId);
    }

    const created = await this.reviews.create({
      targetModuleKey: input.targetModuleKey,
      targetId: input.targetId,
      targetLabel: input.targetLabel ?? null,
      submittedByUserId: actorUserId,
      assignedToUserId: input.assignedToUserId ?? null,
      versionALabel: input.versionALabel ?? null,
      versionBLabel: input.versionBLabel ?? null,
    });

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "review",
      entityId: created.id,
      action: "create",
      afterState: { targetModuleKey: created.targetModuleKey, targetId: created.targetId },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async findById(id: string): Promise<ReviewEntity> {
    const review = await this.reviews.findById(id);
    if (!review) {
      throw new NotFoundException(`Review not found: ${id}`);
    }
    return review;
  }

  /** `?assignedToMe=true` is resolved here, not in the repository, to the caller's own
   *  `actorUserId` — the RBAC matrix's own top-of-file doc comment names this exact
   *  "(assigned)" object-level-scoping requirement as this module's own responsibility to enforce
   *  (task package §1). */
  async list(query: ListReviewsQueryDto, actorUserId: string): Promise<readonly ReviewEntity[]> {
    return this.reviews.list({
      status: query.status,
      targetModuleKey: query.targetModuleKey,
      assignedToUserId: query.assignedToMe ? actorUserId : undefined,
      search: query.search,
      limit: query.limit,
      offset: query.offset,
    });
  }

  /**
   * One method handling all 4 approval-shaped actions (`approve`/`approve_with_notes`/`reject`/
   * `request_revision`, task package §4) — an atomic compare-and-swap on the caller-supplied
   * `expectedStatus`, gated by separation of duties (D4) BEFORE the write, then mirrored into both
   * `review_decisions` (this module's own local history) and `audit_events` (D5).
   */
  async decide(id: string, dto: DecideReviewDto, actorUserId: string): Promise<ReviewEntity> {
    const review = await this.findById(id);

    // Two different RBAC actions gate this one method depending on which action is requested
    // (task package D10) — checked dynamically, not via a static @RequirePermission, mirroring
    // ContentTemplatesService.changeApprovalStatus()'s own layered pattern.
    await this.authorizationService.assertAllowed(
      actorUserId,
      REVIEW_AND_APPROVAL_CENTER_MODULE_KEY,
      REQUIRED_ACTION_FOR_DECISION[dto.action],
    );

    // Separation of duties (task package D4) — the submitter can never also be the actor deciding
    // their own submission, for any of the 4 approval-shaped actions (including
    // request_revision — a real decision, not merely an approval).
    await this.separationOfDuties.assertDistinctActors(
      actorUserId,
      review.submittedByUserId,
      "review approver",
      { entityType: "review", entityId: review.id, retentionCategory: "approval-audit-7y" },
    );

    const nextStatus = NEXT_STATUS_FOR_DECISION[dto.action];
    const decidedAt = new Date();

    const result = await this.reviews.updateStatus(
      id,
      dto.expectedStatus,
      nextStatus,
      actorUserId,
      decidedAt,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Review not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Review ${id} status changed concurrently ` +
          `(expected ${dto.expectedStatus}, now ${result.entity.status}) — reload and retry`,
      );
    }

    // This module's own queryable local history (task package D1) — always written for a
    // successful decide() call, distinct from the audit_events mirror below.
    await this.reviewDecisions.create({
      reviewId: id,
      action: dto.action,
      actorUserId,
      notes: dto.notes ?? null,
      decidedAt,
    });

    // Every decide() action is approval-shaped (task package D5) — always mirrored into the real,
    // DB-trigger-enforced audit_events table. A failed audit write here is caught and only
    // console.error'd, not retried or alerted on — the byte-identical, already-accepted pattern
    // ContentTemplatesService.changeApprovalStatus()/InternalLinksService.changeStatus() both have.
    try {
      await this.auditService.record({
        eventType: "approval",
        actorUserId,
        actorType: "human",
        entityType: "review",
        entityId: id,
        action: dto.action,
        beforeState: { status: review.status },
        afterState: { status: nextStatus },
        reason: dto.notes ?? null,
        retentionCategory: "approval-audit-7y",
      });
    } catch (error) {
      console.error(
        `Review ${id} decision "${dto.action}" committed, but recording its audit event failed:`,
        error,
      );
    }

    return result.entity;
  }

  /**
   * Toggle `isPaused` — orthogonal to `status` (task package D2), advisory only, never a blocking
   * gate on other transitions. Not routed through `audit_events` (task package D5): "preserve
   * immutable *approval* events," not "immutable everything" — pause/resume are process-management
   * actions, not approval decisions.
   */
  async setPaused(id: string, dto: SetReviewPausedDto, actorUserId: string): Promise<ReviewEntity> {
    await this.authorizationService.assertAllowed(
      actorUserId,
      REVIEW_AND_APPROVAL_CENTER_MODULE_KEY,
      "review",
    );

    const result = await this.reviews.updatePaused(id, dto.expectedIsPaused, dto.isPaused);
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Review not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Review ${id} pause state (or status) changed concurrently — reload and retry`,
      );
    }

    await this.reviewDecisions.create({
      reviewId: id,
      action: dto.isPaused ? "pause" : "resume",
      actorUserId,
    });

    return result.entity;
  }

  /**
   * Reassign `assignedToUserId` — an administrative action (task package D10), gated on `edit`
   * rather than `review`/`approve`, matching that only `super_admin`/`owner_growth_approver` hold
   * `E` in the seeded matrix. Not routed through `audit_events` (task package D5) — process
   * management, not an approval decision.
   */
  async delegate(id: string, dto: DelegateReviewDto, actorUserId: string): Promise<ReviewEntity> {
    await this.authorizationService.assertAllowed(
      actorUserId,
      REVIEW_AND_APPROVAL_CENTER_MODULE_KEY,
      "edit",
    );

    await this.assertAssigneeExists(dto.assignedToUserId);

    const result = await this.reviews.updateAssignee(id, dto.assignedToUserId);
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Review not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Review ${id} is decided (terminal) and can no longer be delegated`,
      );
    }

    await this.reviewDecisions.create({
      reviewId: id,
      action: "delegate",
      actorUserId,
      delegatedToUserId: dto.assignedToUserId,
    });

    return result.entity;
  }
}
