import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  withTransaction,
  type ReleaseApprovalRepository,
  type ReleaseApprovalStage,
  type ReleaseEntity,
  type ReleaseListFilter,
  type ReleaseRepository,
  type ReleaseStatus,
  type RollbackRecordRepository,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import {
  RELEASE_APPROVAL_REPOSITORY,
  RELEASE_CENTER_MODULE_KEY,
  RELEASE_REPOSITORY,
  ROLLBACK_RECORD_REPOSITORY,
} from "./release-center.constants.js";
import type {
  ChangeReleaseStatusDto,
  CreateReleaseDto,
  UpdateReleaseDto,
} from "./release-center.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
import { unwrapCasResult } from "../common/cas-result.util.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ProjectService } from "../projects/project.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { UsersService } from "../users/users.service.js";

/** The real, seeded RBAC action (`06_Roles_and_Permissions.md` — `releases` group, D1) required
 *  for a given `status` transition. `release` is used for both every `-> *_deployed` transition
 *  AND every `-> rolled_back` transition — `release-center.constants.ts`'s own doc comment records
 *  why: the module design's own `TRANSITIONS` table (`docs/implementation/module-release-center.md`)
 *  names `release` as the action for every one of these rows, since the seeded `L` letter always
 *  expands into both the `release`/`rollback` grants together, so this module never needs to check
 *  the two separately. */
type ReleaseTransitionAction = "submit" | "review" | "approve" | "release";

/** Bundles `stage` and `decision` together (rather than two independently-optional fields) so a
 *  transition either logs a full, well-formed `release_approvals` row or logs nothing at all —
 *  code-review finding: a bare optional `approvalStage` field on `ReleaseTransition`, gated only on
 *  `action === "approve"`, let `decision` be hardcoded to the literal `"approved"` everywhere,
 *  making the schema's own `"rejected"`/`"hotfix_required"` enum values permanently unreachable and
 *  silently dropping every negative outcome (a `review`-gated rejection into `verification_failed`
 *  or `hotfix_required`) from the approvals history entirely — the exact "approvals" field the
 *  design doc names. Every `review`/`approve` transition that represents a real governance decision
 *  now carries its own explicit `decision` value here, not a hardcoded constant. */
interface ReleaseApprovalLog {
  readonly stage: ReleaseApprovalStage;
  readonly decision: "approved" | "rejected" | "hotfix_required";
}

interface ReleaseTransition {
  readonly action: ReleaseTransitionAction;
  /** Present only on transitions that represent a real governance decision worth recording in the
   *  `release_approvals` history — every field here is required together, so a transition either
   *  logs a complete, correctly-decisioned row or logs nothing (never a row with a
   *  wrong/hardcoded `decision`). */
  readonly approvalLog?: ReleaseApprovalLog;
}

/** Every key is a template-literal type over the real `ReleaseStatus` union (mirrors
 *  `CaseStudyTransitionKey`'s own compile-time-safety precedent — a plain `string` key gives a
 *  typo'd `from`/`to` value no compile-time signal). */
type ReleaseTransitionKey = `${ReleaseStatus}->${ReleaseStatus}`;

/**
 * The full transition->action map, keyed by `${from}->${to}`, taken verbatim from
 * `docs/implementation/module-release-center.md`'s own 23-row `TRANSITIONS` table
 * (`05_Workflow_State_Machines.md §10`'s happy path plus this build's own reasonable
 * failure/exception edges, flagged as such in the design doc). `rolled_back` and (barring the one
 * `completed -> hotfix_required` re-entry) `completed` are the only true terminal states.
 */
const TRANSITIONS: ReadonlyMap<ReleaseTransitionKey, ReleaseTransition> = new Map<
  ReleaseTransitionKey,
  ReleaseTransition
>([
  ["proposed->checks_running", { action: "submit" }],
  ["checks_running->ready_for_staging", { action: "review" }],
  ["checks_running->checks_failed", { action: "review" }],
  ["checks_failed->checks_running", { action: "submit" }],
  ["checks_failed->proposed", { action: "submit" }],
  ["ready_for_staging->staging_deployed", { action: "release" }],
  ["staging_deployed->staging_verification", { action: "review" }],
  [
    "staging_verification->staging_approved",
    { action: "approve", approvalLog: { stage: "staging", decision: "approved" } },
  ],
  [
    "staging_verification->verification_failed",
    { action: "review", approvalLog: { stage: "staging", decision: "rejected" } },
  ],
  ["verification_failed->staging_deployed", { action: "release" }],
  ["verification_failed->production_deployed", { action: "release" }],
  [
    "staging_approved->production_approval",
    { action: "approve", approvalLog: { stage: "production", decision: "approved" } },
  ],
  ["production_approval->production_deployed", { action: "release" }],
  ["production_deployed->production_verification", { action: "review" }],
  [
    "production_verification->completed",
    { action: "approve", approvalLog: { stage: "production", decision: "approved" } },
  ],
  [
    "production_verification->verification_failed",
    { action: "review", approvalLog: { stage: "production", decision: "rejected" } },
  ],
  [
    "production_deployed->hotfix_required",
    { action: "review", approvalLog: { stage: "production", decision: "hotfix_required" } },
  ],
  [
    "production_verification->hotfix_required",
    { action: "review", approvalLog: { stage: "production", decision: "hotfix_required" } },
  ],
  [
    "completed->hotfix_required",
    { action: "review", approvalLog: { stage: "production", decision: "hotfix_required" } },
  ],
  ["staging_deployed->rolled_back", { action: "release" }],
  ["production_deployed->rolled_back", { action: "release" }],
  ["completed->rolled_back", { action: "release" }],
  ["hotfix_required->rolled_back", { action: "release" }],
]);

/** Content edits are blocked once a release is past active drafting for THIS release cycle — the
 *  same terminal-for-editing set the design doc's own "RBAC actions used" section names:
 *  `completed`/`rolled_back` are genuinely terminal, and `checks_failed`'s only outbound edges are
 *  `submit` (re-request checks), not `edit`. */
const EDIT_BLOCKED_STATUSES: ReadonlySet<ReleaseStatus> = new Set([
  "completed",
  "rolled_back",
  "checks_failed",
]);

@Injectable()
export class ReleasesService {
  constructor(
    @Inject(RELEASE_REPOSITORY) private readonly releases: ReleaseRepository,
    @Inject(RELEASE_APPROVAL_REPOSITORY)
    private readonly releaseApprovals: ReleaseApprovalRepository,
    @Inject(ROLLBACK_RECORD_REPOSITORY)
    private readonly rollbackRecords: RollbackRecordRepository,
    private readonly projects: ProjectService,
    private readonly usersService: UsersService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    projectId: string,
    input: CreateReleaseDto,
    actorUserId: string,
  ): Promise<ReleaseEntity> {
    // Independent checks (different tables, none consumes another's result) — run concurrently,
    // matching TechnicalCheckDefinitionsService.create()'s/ServicesService.create()'s own
    // established pattern.
    const [, existing] = await Promise.all([
      this.projects.findById(projectId),
      this.releases.findByPublicId(input.publicId),
      input.assignedDeveloperUserId
        ? this.usersService.assertUserExists(
            input.assignedDeveloperUserId,
            "assignedDeveloperUserId",
          )
        : Promise.resolve(),
      input.assignedReviewerUserId
        ? this.usersService.assertUserExists(input.assignedReviewerUserId, "assignedReviewerUserId")
        : Promise.resolve(),
    ]);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: ReleaseEntity;
    try {
      created = await this.releases.create({
        ...input,
        projectId,
        createdBy: actorUserId,
      });
    } catch (error) {
      // The publicId uniqueness check above is TOCTOU — the real unique index catches the race
      // loser, but without this catch it would otherwise surface as a raw 500 instead of the same
      // clean 400 the check above already gives the non-racing caller.
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
      entityType: "release",
      entityId: created.id,
      action: "create",
      afterState: { releaseType: created.releaseType, title: created.title },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  /** `projectId`-scoped (IDOR prevention) — a release from a different project, accessed via this
   *  project's own route, is treated as not found rather than silently returned/mutated. */
  async findById(id: string, projectId: string): Promise<ReleaseEntity> {
    const release = await this.releases.findById(id);
    if (!release || release.projectId !== projectId) {
      throw new NotFoundException(`Release not found: ${id}`);
    }
    return release;
  }

  async list(filter: ReleaseListFilter): Promise<readonly ReleaseEntity[]> {
    return this.releases.list(filter);
  }

  /** Content update — `status` and every server-stamped column are deliberately never accepted
   *  here; only `changeStatus()` may change them, same discipline as
   *  `CaseStudiesService.update()`/`TechnicalCheckDefinitionsService.update()`. Rejects editing a
   *  release once its status is in `EDIT_BLOCKED_STATUSES`. */
  async update(
    id: string,
    projectId: string,
    patch: UpdateReleaseDto,
    actorUserId: string,
  ): Promise<ReleaseEntity> {
    const [current] = await Promise.all([
      this.findById(id, projectId),
      patch.assignedDeveloperUserId
        ? this.usersService.assertUserExists(
            patch.assignedDeveloperUserId,
            "assignedDeveloperUserId",
          )
        : Promise.resolve(),
      patch.assignedReviewerUserId
        ? this.usersService.assertUserExists(patch.assignedReviewerUserId, "assignedReviewerUserId")
        : Promise.resolve(),
    ]);

    if (EDIT_BLOCKED_STATUSES.has(current.status)) {
      throw new BadRequestException(
        `Release ${id} has status '${current.status}' and can no longer be edited`,
      );
    }

    const updated = await this.releases.update(id, { ...patch, updatedBy: actorUserId });
    if (!updated) {
      throw new NotFoundException(`Release not found: ${id}`);
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId,
      entityType: "release",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  /**
   * Validates the requested transition against the `TRANSITIONS` map, checks the real per-
   * transition RBAC action dynamically, requires `reason`/`rolledBackSha` specifically on any
   * transition into `rolled_back` (mirroring `CaseStudiesService.changeStatus()`'s own
   * `unpublishReason`-required-on-one-transition precedent), and existence-validates
   * `replacementReleaseId` within the same project when supplied. The atomic CAS status write and
   * a `release_approvals`/`rollback_records` row insert (whichever applies) are committed together
   * in one transaction, mirroring `CaseStudiesService.changeStatus()`'s own `withTransaction()`
   * pairing.
   */
  async changeStatus(
    id: string,
    projectId: string,
    dto: ChangeReleaseStatusDto,
    actorUserId: string,
  ): Promise<ReleaseEntity> {
    const release = await this.findById(id, projectId);
    const nextStatus = dto.status;

    if (release.status === nextStatus) {
      return release; // no-op, not an error — re-requesting the current status is harmless
    }

    const transitionKey: ReleaseTransitionKey = `${release.status}->${nextStatus}`;
    const transition = TRANSITIONS.get(transitionKey);
    if (!transition) {
      throw new BadRequestException(
        `Invalid release status transition: ${release.status} -> ${nextStatus}`,
      );
    }

    if (nextStatus === "rolled_back") {
      if (!dto.reason) {
        throw new BadRequestException("reason is required to roll back a release");
      }
      if (!dto.rolledBackSha) {
        throw new BadRequestException("rolledBackSha is required to roll back a release");
      }
    }

    await this.authorizationService.assertAllowed(
      actorUserId,
      RELEASE_CENTER_MODULE_KEY,
      transition.action,
      projectId,
    );

    if (dto.replacementReleaseId) {
      await this.assertReplacementReleaseExists(projectId, dto.replacementReleaseId, id);
    }

    const decidedAt = new Date();

    const entity = await withTransaction(async (transaction) => {
      const result = await this.releases.updateStatus(
        id,
        release.status,
        nextStatus,
        actorUserId,
        transaction,
      );
      // Throwing inside this callback rolls back the transaction before the exception
      // propagates out of withTransaction() — safe to use the shared helper here even though
      // CaseStudiesService.changeStatus()'s own literal template manually branches instead.
      const updatedRelease = unwrapCasResult(
        result,
        () => `Release not found: ${id}`,
        (entity) =>
          `Release ${id} status changed concurrently ` +
          `(expected ${release.status}, now ${entity.status}) — reload and retry`,
      );

      if (transition.approvalLog) {
        await this.releaseApprovals.create(
          {
            releaseId: id,
            projectId,
            approvalStage: transition.approvalLog.stage,
            decision: transition.approvalLog.decision,
            decidedByUserId: actorUserId,
            notes: dto.notes ?? null,
            decidedAt,
          },
          transaction,
        );
      }

      if (nextStatus === "rolled_back") {
        await this.rollbackRecords.create(
          {
            releaseId: id,
            projectId,
            rolledBackSha: dto.rolledBackSha!,
            reason: dto.reason!,
            replacementReleaseId: dto.replacementReleaseId ?? null,
            rolledBackByUserId: actorUserId,
            rolledBackAt: decidedAt,
          },
          transaction,
        );
      }

      return updatedRelease;
    });

    // Best-effort, outside the transaction — the byte-identical, already-accepted pattern
    // CaseStudiesService.changeStatus()/TechnicalCheckRunsService.changeStatus() both have.
    // Keyed on approvalLog (not `action === "approve"`) so a logged rejection/hotfix_required
    // decision is classified the same way a logged approval is — both are governance decisions.
    const isApproval = transition.approvalLog !== undefined;
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        projectId,
        entityType: "release",
        entityId: id,
        action: `status:${release.status}->${nextStatus}`,
        beforeState: { status: release.status },
        afterState: { status: nextStatus },
        reason: dto.reason ?? dto.notes ?? null,
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Release ${id} status transition ${release.status}->${nextStatus} committed, ` +
          "but recording its audit event failed:",
        error,
      );
    }

    return entity;
  }

  /** Read-only, gated on `view` (same as `findById`) via the controller's own `@RequirePermission`
   *  — returns `release_approvals` rows most-recent-first. */
  async listApprovals(
    id: string,
    projectId: string,
  ): ReturnType<ReleaseApprovalRepository["listByRelease"]> {
    await this.findById(id, projectId);
    return this.releaseApprovals.listByRelease(id);
  }

  /** Self-referential existence check within the same project — mirrors
   *  `ClaimsService`'s/`PersonasService`'s own `assertServiceIdsExist()`-style guard for a
   *  cross-record relationship. Also rejects a release naming itself as its own replacement. */
  private async assertReplacementReleaseExists(
    projectId: string,
    replacementReleaseId: string,
    ownId: string,
  ): Promise<void> {
    if (replacementReleaseId === ownId) {
      throw new BadRequestException("replacementReleaseId cannot reference the release itself");
    }
    const replacement = await this.releases.findById(replacementReleaseId);
    if (!replacement || replacement.projectId !== projectId) {
      throw new BadRequestException(`replacementReleaseId not found: ${replacementReleaseId}`);
    }
  }
}
