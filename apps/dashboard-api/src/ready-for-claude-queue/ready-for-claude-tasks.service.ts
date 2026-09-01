import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ReadyForClaudeTaskEntity,
  ReadyForClaudeTaskListFilter,
  ReadyForClaudeTaskRepository,
  ReadyForClaudeTaskStatus,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import {
  READY_FOR_CLAUDE_QUEUE_MODULE_KEY,
  READY_FOR_CLAUDE_TASK_REPOSITORY,
} from "./ready-for-claude-queue.constants.js";
import type {
  ChangeReadyForClaudeTaskStatusDto,
  CreateReadyForClaudeTaskDto,
  UpdateReadyForClaudeTaskDto,
} from "./ready-for-claude-queue.dto.js";
import { unwrapCasResult } from "../common/cas-result.util.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { SeparationOfDutiesService } from "../auth/common/separation-of-duties.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ProjectService } from "../projects/project.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { UsersService } from "../users/users.service.js";

/** The real, seeded RBAC action required for a given `status` transition
 *  (`00013-seed-rbac-matrix.ts`'s `ready_for_claude` group). */
type ReadyForClaudeWorkflowAction = "submit" | "edit" | "review" | "approve";

/**
 * A genuinely bespoke 11-state transition table (D4), sourced from
 * `05_Workflow_State_Machines.md §4`'s own diagram — NOT any prior module's 8-value `TRANSITIONS`
 * table, since the states themselves differ entirely. The single source of truth for BOTH the
 * legal edges and the real, seeded RBAC action each edge requires:
 *
 *   draft             -> ready_for_claude    submit   ("mark Ready for Claude")
 *   draft             -> cancelled           edit
 *   ready_for_claude  -> claimed             edit     ("claim")
 *   ready_for_claude  -> cancelled           edit
 *   claimed           -> in_progress         edit     ("start")
 *   claimed           -> cancelled           edit
 *   in_progress       -> paused              edit
 *   paused            -> in_progress         edit     ("resume")
 *   in_progress       -> failed              edit
 *   in_progress       -> awaiting_review     submit   ("submit for review")
 *   awaiting_review   -> changes_requested   review   ("request revision")
 *   changes_requested -> ready_for_claude    submit   (back into the queue)
 *   awaiting_review   -> approved            approve
 *   approved          -> completed           approve  ("complete")
 *
 * `completed`, `cancelled`, and `failed` are TERMINAL — they appear as keys with an empty edge set
 * (rather than being omitted) so that `TRANSITIONS[status]` is total over the status union and a
 * lookup can never be `undefined`, and so a future state gaining an outbound edge is a one-line
 * change here rather than a structural one. `update()` additionally refuses a plain content edit
 * on a task sitting in any of them.
 *
 * This maps exactly onto the seeded `ready_for_claude` RBAC row, including a real, deliberate
 * separation of duties: the four mid-tier roles hold `VCSE` (so they can draft/mark-ready/claim/
 * start/pause/fail/submit/cancel) but never `review`/`approve`; `super_admin`/
 * `owner_growth_approver` hold `VCERAM` and so can request-revision/approve/complete but — a real
 * property of the approved matrix, recorded rather than worked around — hold no `submit` grant at
 * all. No single role can therefore drive one task through its whole lifecycle alone.
 */
const TRANSITIONS: Readonly<
  Record<
    ReadyForClaudeTaskStatus,
    Readonly<Partial<Record<ReadyForClaudeTaskStatus, ReadyForClaudeWorkflowAction>>>
  >
> = {
  draft: { ready_for_claude: "submit", cancelled: "edit" },
  ready_for_claude: { claimed: "edit", cancelled: "edit" },
  claimed: { in_progress: "edit", cancelled: "edit" },
  in_progress: { paused: "edit", failed: "edit", awaiting_review: "submit" },
  paused: { in_progress: "edit" },
  awaiting_review: { changes_requested: "review", approved: "approve" },
  changes_requested: { ready_for_claude: "submit" },
  approved: { completed: "approve" },
  completed: {},
  cancelled: {},
  failed: {},
};

/** No outbound transition exists from any of these, and a plain content edit is refused too (D4).
 *  Derived from `TRANSITIONS` itself rather than hand-listed, so the two can never drift. */
const TERMINAL_STATUSES: readonly ReadyForClaudeTaskStatus[] = (
  Object.keys(TRANSITIONS) as ReadyForClaudeTaskStatus[]
).filter((status) => Object.keys(TRANSITIONS[status]).length === 0);

@Injectable()
export class ReadyForClaudeTasksService {
  constructor(
    @Inject(READY_FOR_CLAUDE_TASK_REPOSITORY)
    private readonly tasks: ReadyForClaudeTaskRepository,
    private readonly projects: ProjectService,
    private readonly usersService: UsersService,
    private readonly authorizationService: AuthorizationService,
    private readonly separationOfDuties: SeparationOfDutiesService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * D2 — every dependency id must be a real row in THIS same table. One batched `IN (...)` query
   * (code-review finding — previously N single-id round trips, one per dependency, up to the DTO's
   * own 50-id cap), mirroring `ServiceRepository.findByIds()`'s own established "validate an array
   * of ids against a table" pattern. Duplicate ids are de-duplicated first so a caller repeating
   * the same id 50 times still only issues one lookup for it.
   */
  private async assertDependenciesExist(dependencies: readonly string[]): Promise<void> {
    const unique = [...new Set(dependencies)];
    const existing = await this.tasks.existingIds(unique);
    const missing = unique.filter((id) => !existing.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(
        `dependencies contains ids that do not resolve to a Ready for Claude task: ${missing.join(", ")}`,
      );
    }
  }

  /**
   * D2 — the "must complete before this one" contract the `dependencies` column is documented as
   * (migration `00101`'s own doc comment), actually enforced (code-review finding — existence
   * validation alone let a task freely enter `in_progress` regardless of its dependencies' real
   * status). Enforced at the one transition where it matters — `claimed -> in_progress`, i.e.
   * before real work starts — not at every earlier, purely-administrative transition
   * (draft/ready_for_claude/claimed), which a task may legitimately reach before its blockers
   * finish.
   */
  private async assertDependenciesCompleted(dependencies: readonly string[]): Promise<void> {
    if (dependencies.length === 0) {
      return;
    }
    const tasks = await Promise.all(dependencies.map((id) => this.tasks.findById(id)));
    const incomplete = tasks
      .filter((task): task is ReadyForClaudeTaskEntity => task !== null)
      .filter((task) => task.status !== "completed")
      .map((task) => task.id);
    if (incomplete.length > 0) {
      throw new BadRequestException(
        `Cannot start: dependencies not yet completed: ${incomplete.join(", ")}`,
      );
    }
  }

  /** D1 — validated against the REAL module registry, mirroring `ReviewsService.create()`'s own
   *  identical check. A clean 400, not a silently-accepted dangling module key. */
  private async assertValidTargetModuleKey(targetModuleKey: string): Promise<void> {
    const isValid = await this.authorizationService.isValidModuleKey(targetModuleKey);
    if (!isValid) {
      throw new BadRequestException(
        `targetModuleKey does not resolve to a real module: ${targetModuleKey}`,
      );
    }
  }

  /**
   * The three nullable, caller-settable user-reference fields, validated via
   * `UsersService.assertUserExists()` (the shared helper extracted during Review and Approval
   * Center's own code review) — a clean 400, not a raw FK-violation 500. `productionApproverUserId`
   * is deliberately NOT among them (code-review finding) — it is server-managed, stamped only by
   * `updateStatus()`'s own atomic write, never caller-settable via `create()`/`update()`. `only`
   * narrows the check to the fields actually present in a patch, so `update()` never re-validates
   * an unchanged (possibly since-deactivated) user and blocks an edit that doesn't touch that
   * field at all.
   */
  private userFieldChecks(
    input: Partial<
      Pick<CreateReadyForClaudeTaskDto, "operatorUserId" | "developerUserId" | "reviewerUserId">
    >,
  ): Array<Promise<void>> {
    const fields = ["operatorUserId", "developerUserId", "reviewerUserId"] as const;
    return fields
      .filter((field) => Boolean(input[field]))
      .map((field) => this.usersService.assertUserExists(input[field]!, field));
  }

  async create(
    input: CreateReadyForClaudeTaskDto,
    actorUserId: string,
  ): Promise<ReadyForClaudeTaskEntity> {
    // Every check below is an independent DB-backed lookup with no dependency on any other
    // check's result, so they all run concurrently — the exact bug class this codebase's own code
    // reviews have caught repeatedly (independent checks issued as sequential round trips).
    const checks: Array<Promise<unknown>> = [
      this.tasks.findByPublicId(input.publicId),
      input.projectId ? this.projects.findById(input.projectId) : Promise.resolve(),
      input.targetModuleKey
        ? this.assertValidTargetModuleKey(input.targetModuleKey)
        : Promise.resolve(),
      input.dependencies?.length
        ? this.assertDependenciesExist(input.dependencies)
        : Promise.resolve(),
      ...this.userFieldChecks(input),
    ];

    const [existing] = await Promise.all(checks);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: ReadyForClaudeTaskEntity;
    try {
      created = await this.tasks.create({
        ...input,
        dependencies: input.dependencies ?? [],
        createdBy: actorUserId,
      });
    } catch (error) {
      // The publicId uniqueness check above is TOCTOU (two concurrent creates with the same
      // publicId can both pass it before either INSERT commits) — the real unique index catches
      // the race loser, but without this catch it would surface as a raw 500 instead of the same
      // clean 400 the check above already gives the non-racing caller. Uses the shared
      // `isSequelizeUniqueConstraintError()` helper (`@webdesk/validation`) rather than a manual
      // `error.name` comparison — the exact duplication Brand Library's own code review found.
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(`publicId already in use: ${input.publicId}`);
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId: created.projectId ?? undefined,
      entityType: "ready_for_claude_task",
      entityId: created.id,
      action: "create",
      afterState: { publicId: created.publicId, title: created.title, status: created.status },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  /** Organization-wide (D5) — no `projectId` scoping here, unlike Page Inventory/Keyword & Entity
   *  Library/Internal Linking Library. A task's own `projectId` is an optional context field, not
   *  an access boundary; RBAC for this module is organization-wide, matching Review and Approval
   *  Center's own precedent for a cross-cutting engine. */
  async findById(id: string): Promise<ReadyForClaudeTaskEntity> {
    const task = await this.tasks.findById(id);
    if (!task) {
      throw new NotFoundException(`Ready for Claude task not found: ${id}`);
    }
    return task;
  }

  async list(
    filter: ReadyForClaudeTaskListFilter = {},
  ): Promise<readonly ReadyForClaudeTaskEntity[]> {
    return this.tasks.list(filter);
  }

  async update(
    id: string,
    patch: UpdateReadyForClaudeTaskDto,
    actorUserId: string,
  ): Promise<ReadyForClaudeTaskEntity> {
    const current = await this.findById(id);

    // Terminal-state guard (D4) — the exact gap-class Website Strategy Center's and Page
    // Inventory's own reviews both converged on closing: without it, a caller holding only `edit`
    // could freely mutate a task that is permanently completed/cancelled/failed. Checked before
    // any relationship re-validation, so the caller gets the more specific error.
    if (TERMINAL_STATUSES.includes(current.status)) {
      throw new BadRequestException(
        `Ready for Claude task ${id} is ${current.status} and can no longer be edited`,
      );
    }

    // A self-dependency would let a task permanently block itself. Cheap, purely local check, run
    // before any database round trip.
    this.assertNoSelfDependency(id, patch.dependencies);

    // Only re-validate a relationship that is actually changing from its current value — mirrors
    // `PersonasService.update()`'s/`InternalLinksService.update()`'s own "only re-validate on
    // change" pattern. A single Promise.all literal rather than a mutable array built up via
    // conditional .push() calls, matching `ServicesService.update()`'s own equivalent shape.
    await Promise.all([
      patch.targetModuleKey && patch.targetModuleKey !== current.targetModuleKey
        ? this.assertValidTargetModuleKey(patch.targetModuleKey)
        : Promise.resolve(),
      patch.dependencies?.length
        ? this.assertDependenciesExist(patch.dependencies)
        : Promise.resolve(),
      ...this.userFieldChecks({
        operatorUserId:
          patch.operatorUserId !== current.operatorUserId ? patch.operatorUserId : undefined,
        developerUserId:
          patch.developerUserId !== current.developerUserId ? patch.developerUserId : undefined,
        reviewerUserId:
          patch.reviewerUserId !== current.reviewerUserId ? patch.reviewerUserId : undefined,
      }),
    ]);

    // current.status is passed as a CAS guard — without it, a concurrent changeStatus() landing
    // between the read above and this write could let the edit silently succeed against a status
    // the caller never saw, INCLUDING one that has since become terminal (which would defeat the
    // terminal-state guard above entirely). The exact race Page Inventory's own security review
    // caught after its own first-round terminal-state fix left the read/write split open.
    const { dependencies, ...rest } = patch;
    const updated = await this.tasks.update(
      id,
      {
        ...rest,
        // `dependencies` is NOT NULL at the database layer, so an explicit `null` (which the DTO
        // accepts as "clear it") is normalized to the empty array rather than written through —
        // mirrors `PersonaRepository.update()`'s own identical normalization. An omitted key stays
        // omitted (destructured out of the spread above), so an unrelated patch never touches the
        // column at all.
        ...(dependencies !== undefined ? { dependencies: dependencies ?? [] } : {}),
        updatedBy: actorUserId,
      },
      current.status,
    );
    if (!updated) {
      // 0 affected rows means either the row is genuinely gone, or — the real case the CAS guard
      // exists for — its status changed concurrently since the read. Disambiguate with a fresh
      // read rather than assuming either.
      const stillExists = await this.tasks.findById(id);
      if (!stillExists) {
        throw new NotFoundException(`Ready for Claude task not found: ${id}`);
      }
      throw new ConflictException(
        `Ready for Claude task ${id} status changed concurrently while editing — reload and retry`,
      );
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      projectId: current.projectId ?? undefined,
      entityType: "ready_for_claude_task",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  /** A task may never list itself as one of its own blocking dependencies — it would permanently
   *  block itself. Compared case-insensitively, since Zod's `.uuid()` accepts mixed-case UUIDs
   *  unchanged and a bare `===` would let a differently-cased representation of the same id
   *  through (the exact bug Internal Linking Library's own code review found in its self-link
   *  guard). Only reachable on `update()` — on `create()` the task's own id does not exist yet. */
  private assertNoSelfDependency(id: string, dependencies?: readonly string[] | null): void {
    if (!dependencies?.length) {
      return;
    }
    const self = id.toLowerCase();
    if (dependencies.some((dependencyId) => dependencyId.toLowerCase() === self)) {
      throw new BadRequestException("A task may not depend on itself");
    }
  }

  /**
   * The single method implementing the whole `TRANSITIONS` table. The RBAC action is looked up
   * from that table and checked DYNAMICALLY here rather than statically on the route — the four
   * distinct actions (`submit`/`edit`/`review`/`approve`) map to genuinely different role tiers in
   * the seeded matrix, so no single `@RequirePermission` on the controller could express the real
   * gate. Mirrors `InternalLinksService.changeStatus()`'s/`ReviewsService.decide()`'s own layered
   * pattern exactly.
   *
   * `expectedStatus` is caller-supplied and threaded straight into the repository's atomic
   * compare-and-swap, so a caller acting on a stale view gets a clean 409 rather than silently
   * overwriting someone else's transition.
   */
  async changeStatus(
    id: string,
    dto: ChangeReadyForClaudeTaskStatusDto,
    actorUserId: string,
  ): Promise<ReadyForClaudeTaskEntity> {
    const { status: nextStatus, expectedStatus } = dto;

    if (expectedStatus === nextStatus) {
      throw new BadRequestException(
        `Ready for Claude task status is already ${nextStatus} — no transition requested`,
      );
    }

    const requiredAction = TRANSITIONS[expectedStatus][nextStatus];
    if (!requiredAction) {
      const legal = Object.keys(TRANSITIONS[expectedStatus]);
      throw new BadRequestException(
        `Invalid Ready for Claude task status transition: ${expectedStatus} -> ${nextStatus}. ` +
          (legal.length > 0
            ? `Legal next states from ${expectedStatus}: ${legal.join(", ")}`
            : `${expectedStatus} is terminal — no further transition is possible`),
      );
    }

    // The dynamic per-transition gate. No `projectId` is threaded in (unlike Internal Linking
    // Library's own call) — this module's RBAC is organization-wide (D5); a task's optional
    // `projectId` is a context field, not an access scope.
    await this.authorizationService.assertAllowed(
      actorUserId,
      READY_FOR_CLAUDE_QUEUE_MODULE_KEY,
      requiredAction,
    );

    const current = await this.findById(id);

    // Separation of duties (code-review finding) — mirrors `ReviewsService.decide()`'s own
    // identical check. The module's original doc comment argued this was unnecessary because "no
    // role holds both submit and approve," but `user_roles` has no one-role-per-user constraint
    // (`00012-create-user-roles.ts`), so a single user CAN hold both a submit-capable role and
    // super_admin/owner_growth_approver simultaneously — a legitimate RBAC configuration this
    // check must still cover. `current.createdBy` stands in for "the submitter" (this module has
    // no dedicated per-submission actor field, unlike Review and Approval Center's
    // `submittedByUserId`) — the closest real signal for "who is this task's own work," so the
    // actor exercising `review`/`approve` can never also be the task's own creator. Skipped only
    // when `createdBy` is null (a task with no recorded creator, e.g. a pre-existing row).
    if ((requiredAction === "review" || requiredAction === "approve") && current.createdBy) {
      await this.separationOfDuties.assertDistinctActors(
        actorUserId,
        current.createdBy,
        "Ready for Claude task reviewer/approver",
        {
          entityType: "ready_for_claude_task",
          entityId: id,
          retentionCategory: "approval-audit-7y",
        },
      );
    }

    // D2 — enforced only at the one transition where it matters (see
    // `assertDependenciesCompleted()`'s own doc comment).
    if (nextStatus === "in_progress") {
      await this.assertDependenciesCompleted(current.dependencies);
    }

    const task = unwrapCasResult(
      await this.tasks.updateStatus(id, expectedStatus, nextStatus, actorUserId),
      () => `Ready for Claude task not found: ${id}`,
      (entity) =>
        `Ready for Claude task ${id} status changed concurrently ` +
        `(expected ${expectedStatus}, now ${entity.status}) — reload and retry`,
    );

    // Classified by the REQUIRED ACTION rather than by the target status alone — this module's
    // approval-shaped edges land on three different statuses (`changes_requested` via `review`,
    // `approved` and `completed` via `approve`), so the sibling modules' `nextStatus ===
    // "approved"` check would under-classify two of them. Same two-bucket outcome, generalized to
    // a workflow with more than one approval-shaped edge.
    const isApproval = requiredAction === "approve" || requiredAction === "review";
    // A failed audit write here is caught and only console.error'd, not retried or alerted on —
    // the byte-identical, already-accepted pattern InternalLinksService.changeStatus()/
    // ContentTemplatesService.changeApprovalStatus()/ClaimsService.changeApprovalStatus() all have.
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        projectId: task.projectId ?? undefined,
        entityType: "ready_for_claude_task",
        entityId: id,
        action: `status:${expectedStatus}->${nextStatus}`,
        beforeState: { status: expectedStatus },
        afterState: { status: nextStatus },
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Ready for Claude task ${id} status transition ${expectedStatus}->${nextStatus} committed, ` +
          "but recording its audit event failed:",
        error,
      );
    }

    return task;
  }
}
