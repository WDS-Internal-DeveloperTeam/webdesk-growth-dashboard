import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ChangeRecordEntity,
  ChangeRecordListFilter,
  ChangeRecordRepository,
  ChangeRecordStatus,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import { CHANGE_CENTER_MODULE_KEY, CHANGE_RECORD_REPOSITORY } from "./change-center.constants.js";
import type {
  ChangeChangeRecordStatusDto,
  CreateChangeRecordDto,
  UpdateChangeRecordDto,
} from "./change-center.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ProjectService } from "../projects/project.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ScanFindingsService } from "../scan-center/scan-findings.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { UsersService } from "../users/users.service.js";
import { unwrapCasResult } from "../common/cas-result.util.js";

/** The real, seeded RBAC action required for a given `status` transition — only `review`/
 *  `approve` exist in this module's own five-letter action set (`change-center.constants.ts`'s
 *  own doc comment). Every review/decision step (starting review, and every disposition out of
 *  `under_review`/`manual_merge_required`/`deferred`) requires `review`; the entire apply+verify
 *  tail (`accepted -> applying -> applied/apply_failed -> ... -> verified`) requires `approve` —
 *  there is no separate seeded "apply"/"verify" letter, so both halves share the one grant.
 *  `rejected`/`verified` are terminal — no outbound transition. */
type ChangeRecordWorkflowAction = "review" | "approve";

const TRANSITIONS: Readonly<
  Record<
    ChangeRecordStatus,
    Readonly<Partial<Record<ChangeRecordStatus, ChangeRecordWorkflowAction>>>
  >
> = {
  detected: { under_review: "review" },
  under_review: {
    accepted: "review",
    rejected: "review",
    deferred: "review",
    manual_merge_required: "review",
  },
  manual_merge_required: { accepted: "review", rejected: "review", deferred: "review" },
  deferred: { under_review: "review" },
  accepted: { applying: "approve" },
  applying: { applied: "approve", apply_failed: "approve" },
  apply_failed: { applying: "approve" },
  applied: { verified: "approve" },
  rejected: {},
  verified: {},
};

/** A change record's content fields may only be edited (via `update()`) while it's still in
 *  `detected`/`under_review` — once a real decision or apply/verify step has started, the record
 *  is locked to content edits (task description D-scope) and only `changeStatus()` may move it
 *  further. */
const EDITABLE_STATUSES: ReadonlySet<ChangeRecordStatus> = new Set(["detected", "under_review"]);

/** The three genuinely approval/completion-shaped milestones — audited as `"approval"` events
 *  (retained under `approval-audit-7y`) rather than the generic `"data_change"`/`audit-7y` every
 *  other transition uses. A deliberate design choice (no single seeded action letter maps
 *  cleanly onto "this transition is an approval") — flagged explicitly since it isn't dictated by
 *  any prior sibling module's own identical shape. */
const APPROVAL_LIKE_STATUSES: ReadonlySet<ChangeRecordStatus> = new Set([
  "accepted",
  "applied",
  "verified",
]);

@Injectable()
export class ChangeRecordsService {
  constructor(
    @Inject(CHANGE_RECORD_REPOSITORY) private readonly records: ChangeRecordRepository,
    private readonly projects: ProjectService,
    private readonly scanFindings: ScanFindingsService,
    private readonly usersService: UsersService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  /** Existence-and-same-project validated via `ScanFindingsService.findById()` (itself already
   *  `projectId`-scoped for IDOR prevention) — a clean 400, not a raw FK-violation 500 or a silent
   *  cross-project dangling reference. */
  private async assertScanFindingExists(scanFindingId: string, projectId: string): Promise<void> {
    try {
      await this.scanFindings.findById(scanFindingId, projectId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new BadRequestException(
          `scanFindingId does not resolve to a scan finding in this project: ${scanFindingId}`,
        );
      }
      throw error;
    }
  }

  /** `targetId` existence is deliberately NOT checked — mirrors Review and Approval Center's own
   *  `create()` restraint exactly: no generic cross-module lookup capability exists to validate an
   *  arbitrary module's own record id against. Only `targetModuleKey` is validated, against the
   *  real canonical module registry. */
  private async assertValidTargetModuleKey(targetModuleKey: string): Promise<void> {
    const isValid = await this.authorizationService.isValidModuleKey(targetModuleKey);
    if (!isValid) {
      throw new BadRequestException(
        `targetModuleKey does not resolve to a real module: ${targetModuleKey}`,
      );
    }
  }

  /** `projectId` is a route-derived parameter, not part of `CreateChangeRecordDto` (mirrors
   *  `InternalLinksService.create()`'s own `(projectId, input, actorUserId)` shape). */
  async create(
    projectId: string,
    input: CreateChangeRecordDto,
    actorUserId: string,
  ): Promise<ChangeRecordEntity> {
    // Every check below is an independent DB-backed lookup with no dependency on another check's
    // result, so they all run via Promise.all — mirrors InternalLinksService.create()'s/
    // ReviewsService.create()'s own already-fixed pattern for this exact bug class.
    const checks: Array<Promise<unknown>> = [
      this.records.findByPublicId(input.publicId),
      this.projects.findById(projectId),
    ];
    if (input.scanFindingId) {
      checks.push(this.assertScanFindingExists(input.scanFindingId, projectId));
    }
    if (input.targetModuleKey) {
      checks.push(this.assertValidTargetModuleKey(input.targetModuleKey));
    }
    if (input.assignedToUserId) {
      checks.push(this.usersService.assertUserExists(input.assignedToUserId, "assignedToUserId"));
    }

    const [existing] = await Promise.all(checks);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: ChangeRecordEntity;
    try {
      created = await this.records.create({
        ...input,
        projectId,
        createdBy: actorUserId,
      });
    } catch (error) {
      // The publicId uniqueness check above is TOCTOU (two concurrent creates with the same
      // publicId can both pass it before either INSERT commits) — the real unique index catches
      // the race loser, giving the same clean 400 instead of a raw 500.
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(`publicId already in use: ${input.publicId}`);
      }
      throw error;
    }

    try {
      await this.auditService.record({
        eventType: "data_change",
        actorUserId,
        actorType: "human",
        projectId: created.projectId,
        entityType: "change_record",
        entityId: created.id,
        action: "create",
        afterState: { category: created.category, severity: created.severity },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      // The change record itself already committed — an audit-write failure here must not turn a
      // genuinely successful create into a caller-visible 500, mirroring changeStatus()'s own
      // identical try/catch below.
      console.error(
        `Change record ${created.id} created, but recording its audit event failed:`,
        error,
      );
    }

    return created;
  }

  /** `projectId`-scoped (IDOR prevention) — a record from a different project, accessed via this
   *  project's own route, is treated as not found rather than silently returned/mutated. */
  async findById(id: string, projectId: string): Promise<ChangeRecordEntity> {
    const record = await this.records.findById(id);
    if (!record || record.projectId !== projectId) {
      throw new NotFoundException(`Change record not found: ${id}`);
    }
    return record;
  }

  async list(filter: ChangeRecordListFilter): Promise<readonly ChangeRecordEntity[]> {
    return this.records.list(filter);
  }

  async update(
    id: string,
    projectId: string,
    patch: UpdateChangeRecordDto,
    actorUserId: string,
  ): Promise<ChangeRecordEntity> {
    const current = await this.findById(id, projectId);

    if (!EDITABLE_STATUSES.has(current.status)) {
      throw new BadRequestException(
        `Change record ${id} is no longer editable (status: ${current.status}) — only records still detected/under_review may have their content edited`,
      );
    }

    // A partial patch might set only one half of the targetModuleKey/targetId pair while leaving
    // the other at its current stored value — the DTO layer can't enforce the pairing invariant
    // for that case (it has no visibility into the current row), so it's checked here against the
    // MERGED final values.
    const nextTargetModuleKey =
      patch.targetModuleKey !== undefined ? patch.targetModuleKey : current.targetModuleKey;
    const nextTargetId = patch.targetId !== undefined ? patch.targetId : current.targetId;
    if ((nextTargetModuleKey != null) !== (nextTargetId != null)) {
      throw new BadRequestException(
        "targetModuleKey and targetId must both be set, or both cleared",
      );
    }

    // Only re-validate a reference that's actually changing from its current value — mirrors
    // InternalLinksService.update()'s/PersonasService.update()'s own "only re-validate on change"
    // pattern.
    await Promise.all([
      patch.scanFindingId && patch.scanFindingId !== current.scanFindingId
        ? this.assertScanFindingExists(patch.scanFindingId, projectId)
        : Promise.resolve(),
      patch.targetModuleKey && patch.targetModuleKey !== current.targetModuleKey
        ? this.assertValidTargetModuleKey(patch.targetModuleKey)
        : Promise.resolve(),
      patch.assignedToUserId && patch.assignedToUserId !== current.assignedToUserId
        ? this.usersService.assertUserExists(patch.assignedToUserId, "assignedToUserId")
        : Promise.resolve(),
    ]);

    // current.status is passed as a CAS guard — without it, a concurrent changeStatus()
    // transition landing between the read above and this write could let this edit silently
    // succeed against a status the caller never actually saw, the already-fixed bug class every
    // sibling module's own update() closes the same way.
    const updated = await this.records.update(
      id,
      { ...patch, updatedBy: actorUserId },
      current.status,
    );
    if (!updated) {
      const stillExists = await this.records.findById(id);
      if (!stillExists) {
        throw new NotFoundException(`Change record not found: ${id}`);
      }
      throw new ConflictException(
        `Change record ${id} status changed concurrently while editing — reload and retry`,
      );
    }

    try {
      await this.auditService.record({
        eventType: "data_change",
        actorUserId,
        actorType: "human",
        projectId: current.projectId,
        entityType: "change_record",
        entityId: id,
        action: "update",
        afterState: { ...patch },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      // The edit itself already committed — see the identical rationale in create() above.
      console.error(`Change record ${id} updated, but recording its audit event failed:`, error);
    }

    return updated;
  }

  async changeStatus(
    id: string,
    projectId: string,
    body: ChangeChangeRecordStatusDto,
    actorUserId: string,
  ): Promise<ChangeRecordEntity> {
    const record = await this.findById(id, projectId);
    const nextStatus = body.status;

    // Accepted, tracked debt (mirrors InternalLinksService.changeStatus()'s/
    // PagesService.changeWorkflowStage()'s own byte-identical, already-shipped shape): no state
    // mutation occurs and the response is identical to what GET already permits under the same
    // grant, so the practical exploit value of skipping assertAllowed() below on a same-status
    // no-op is nil.
    if (record.status === nextStatus) {
      return record;
    }

    const requiredAction = TRANSITIONS[record.status][nextStatus];
    if (!requiredAction) {
      throw new BadRequestException(
        `Invalid change record status transition: ${record.status} -> ${nextStatus}`,
      );
    }

    // record.projectId (== the already-verified projectId param) is threaded into the dynamic
    // per-transition check — mirrors InternalLinksService.changeStatus()'s/
    // KeywordsService.changeApprovalStatus()'s own fix for the identical gap: without it, a
    // caller holding only a project-scoped change_center grant (not a global one) would be denied
    // on every transition.
    await this.authorizationService.assertAllowed(
      actorUserId,
      CHANGE_CENTER_MODULE_KEY,
      requiredAction,
      record.projectId,
    );

    const result = await this.records.updateStatus(id, record.status, nextStatus, actorUserId, {
      // Passed through as-is: changeChangeRecordStatusSchema's own superRefine already guarantees
      // body.rollbackGuidance is undefined whenever nextStatus isn't apply_failed, so re-deriving
      // that same gate here would just duplicate a single source of truth. When it IS undefined,
      // the repository's own updateStatus() decides whether to clear a stale value on the way out
      // of apply_failed — decisionNotes needs no such handling, since it's accepted on any
      // transition (a decision, apply, or verify step may all carry a real human note).
      rollbackGuidance: body.rollbackGuidance,
      decisionNotes: body.decisionNotes,
    });
    const updatedRecord = unwrapCasResult(
      result,
      () => `Change record not found: ${id}`,
      (entity) =>
        `Change record ${id} status changed concurrently (expected ${record.status}, now ${entity.status}) — reload and retry`,
    );

    const isApprovalLike = APPROVAL_LIKE_STATUSES.has(nextStatus);
    try {
      await this.auditService.record({
        eventType: isApprovalLike ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        projectId: record.projectId,
        entityType: "change_record",
        entityId: id,
        action: `status:${record.status}->${nextStatus}`,
        beforeState: { status: record.status },
        afterState: { status: nextStatus },
        retentionCategory: isApprovalLike ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Change record ${id} status transition ${record.status}->${nextStatus} committed, but recording its audit event failed:`,
        error,
      );
    }

    return updatedRecord;
  }
}
