import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { withTransaction } from "@webdesk/database";
import type {
  MotionInteractionApprovalStatus,
  MotionInteractionRecordEntity,
  MotionInteractionRecordListFilter,
  MotionInteractionRecordRepository,
} from "@webdesk/database";
import {
  isSequelizeUniqueConstraintError,
  sanitizeNullableRichText,
  sanitizeNullableRichTextIfChanged,
} from "@webdesk/validation";
import {
  MODULE_KEY,
  MOTION_INTERACTION_RECORD_REPOSITORY,
} from "./motion-and-interaction-library.constants.js";
import type {
  CreateMotionInteractionRecordDto,
  UpdateMotionInteractionRecordDto,
} from "./motion-and-interaction-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ComponentsService } from "../component-library/components.service.js";

/**
 * Sanitizes a genuinely NEW patch value, or inherits the current version's own (already-sanitized)
 * value unchanged when the patch omits the field — the fork branch's own version of the
 * skip-if-unchanged reasoning `sanitizeNullableRichTextIfChanged()` already encodes, but with a
 * non-optional `string | null` return (never `undefined`), since `createNewVersion()` inserts a
 * whole new row and has no partial-update contract to leave a field untouched via. Mirrors
 * `SectionPatternsService`'s/`PageTemplatesService`'s own file-local `sanitizeOrInherit()` helper
 * exactly.
 */
function sanitizeOrInherit(
  patchValue: string | null | undefined,
  currentValue: string | null,
): string | null {
  return patchValue !== undefined ? (sanitizeNullableRichText(patchValue) ?? null) : currentValue;
}

/** The real, seeded RBAC action (`06_Roles_and_Permissions.md`, `creative_design` group)
 *  required for a given `approvalStatus` transition — identical vocabulary to Section and
 *  Pattern Library's/Page Template Library's/Design Token Library's own. */
type MotionInteractionApprovalAction = "submit" | "review" | "approve";

/**
 * Sourced from `05_Workflow_State_Machines.md §2`'s generic artifact lifecycle, reused verbatim
 * from `SectionPatternsService`'s/`PageTemplatesService`'s/`ComponentsService`'s own (already
 * code-reviewed) `TRANSITIONS` table — deliberately not extracted into a shared helper (already-
 * accepted, out-of-scope debt in this codebase). `submitted`/`revision_requested`/
 * `rejected -> draft` all require `submit` (the submitter/editor drives the revise-and-resubmit
 * loop, not the approver). `archived`/`superseded` are both terminal — no code path resurrects a
 * record from either.
 *
 * Mirrors Section and Pattern Library's own table exactly, including its one deliberate
 * deviation from the Service/Persona/Proof-and-Claims Library copies: `approved` has no
 * `superseded` edge here either — "supersede" is never a distinct user action for a
 * version-history module. It only ever happens as an automatic side effect of a DIFFERENT
 * version's own `-> approved` transition succeeding (see the `isApproval` branch below, which
 * calls `supersedeOtherApprovedVersion()` directly, bypassing this table entirely).
 */
const TRANSITIONS: Readonly<
  Record<
    MotionInteractionApprovalStatus,
    Readonly<Partial<Record<MotionInteractionApprovalStatus, MotionInteractionApprovalAction>>>
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
  approved: { archived: "approve" },
  rejected: { draft: "submit", archived: "approve" },
  superseded: {},
  archived: {},
};

@Injectable()
export class MotionInteractionsService {
  constructor(
    @Inject(MOTION_INTERACTION_RECORD_REPOSITORY)
    private readonly records: MotionInteractionRecordRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
    private readonly componentsService: ComponentsService,
  ) {}

  /** A narrow, read-only delegating method, mirroring `SectionPatternsService.existingRecordIds()`'s
   *  own already-reviewed pattern — kept available in case a future module needs an existence
   *  check against this one. Returns only the subset of `ids` that resolve to a real, current
   *  motion/interaction record. */
  async existingRecordIds(ids: readonly string[]): Promise<ReadonlySet<string>> {
    const found = await this.records.findByIds(ids);
    return new Set(found.map((row) => row.recordId));
  }

  /** `relatedComponentIds` entries must resolve to real, current Component Library records —
   *  mirrors `PageTemplatesService.assertComponentIdsExist()` exactly. */
  private async assertComponentIdsExist(ids: readonly string[] | null | undefined): Promise<void> {
    if (!ids || ids.length === 0) {
      return;
    }
    const foundIds = await this.componentsService.existingComponentIds(ids);
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`relatedComponentIds not found: ${missing.join(", ")}`);
    }
  }

  async create(
    input: CreateMotionInteractionRecordDto,
    actorUserId: string,
  ): Promise<MotionInteractionRecordEntity> {
    // Independent checks (different tables/queries, neither consumes the other's result) — run
    // concurrently rather than as sequential round trips (mirrors PageTemplatesService.create()'s
    // own Promise.all reasoning).
    const [existing] = await Promise.all([
      this.records.findCurrentByPublicId(input.publicId),
      this.assertComponentIdsExist(input.relatedComponentIds),
    ]);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: MotionInteractionRecordEntity;
    try {
      created = await this.records.create({
        publicId: input.publicId,
        category: input.category,
        name: input.name,
        description: sanitizeNullableRichText(input.description),
        triggerAndBehavior: sanitizeNullableRichText(input.triggerAndBehavior),
        timingAndEasing: input.timingAndEasing ?? null,
        implementationSpec: input.implementationSpec ?? null,
        accessibilityNotes: sanitizeNullableRichText(input.accessibilityNotes),
        fallbackBehavior: input.fallbackBehavior ?? null,
        designReference: input.designReference ?? null,
        relatedComponentIds: input.relatedComponentIds ?? [],
        createdBy: actorUserId,
      });
    } catch (error) {
      // The publicId uniqueness check above is TOCTOU (two concurrent creates of NEW records
      // with the same publicId can both pass it before either INSERT commits — the partial
      // unique index is `WHERE is_current = true`, so this is specifically a race between two
      // brand-new records, not a version-creation race) — the real unique index catches the race
      // loser, but without this catch it would otherwise surface as a raw 500 instead of the same
      // clean 400 the check above already gives the non-racing caller. Uses the shared
      // `isSequelizeUniqueConstraintError()` helper (`@webdesk/validation`), matching Section and
      // Pattern Library's own already-fixed pattern.
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(`publicId already in use: ${input.publicId}`);
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "motion_interaction_record",
      entityId: created.id,
      action: "create",
      afterState: { name: created.name, category: created.category },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  /** The CURRENT version of a record, by its stable `recordId` — not a row `id`. */
  async findCurrent(recordId: string): Promise<MotionInteractionRecordEntity> {
    const current = await this.records.findCurrentByRecordId(recordId);
    if (!current) {
      throw new NotFoundException(`Motion/interaction record not found: ${recordId}`);
    }
    return current;
  }

  /** Every version of a record, oldest first. A `recordId` that has never existed at all (zero
   *  rows) is a clean 404 — distinct from the repository's own empty-array return, which this
   *  method turns into the right exception rather than leaking an empty list for an unknown id. */
  async listVersions(recordId: string): Promise<readonly MotionInteractionRecordEntity[]> {
    const versions = await this.records.listVersions(recordId);
    if (versions.length === 0) {
      throw new NotFoundException(`Motion/interaction record not found: ${recordId}`);
    }
    return versions;
  }

  async list(
    filter: MotionInteractionRecordListFilter,
  ): Promise<readonly MotionInteractionRecordEntity[]> {
    return this.records.list(filter);
  }

  /**
   * Updates the CURRENT version. If it is NOT `approved`, mutates that same row in place
   * (matching every sibling module's own `update()`). If it IS `approved`, creates a new draft
   * version instead — `category`/`publicId` are copied forward unchanged (immutable across a
   * record's own version chain), and any field the patch omits falls back to the current
   * version's own stored value. The response's own `versionNumber`/`isCurrent`/`id` naturally
   * reveal which path was taken (a new version is, unavoidably, a different row) — no special
   * response wrapper is needed.
   */
  async update(
    recordId: string,
    patch: UpdateMotionInteractionRecordDto,
    actorUserId: string,
  ): Promise<MotionInteractionRecordEntity> {
    // Independent of the current-row read below — run concurrently (mirrors
    // PageTemplatesService.update()'s own fix for the identical "sequential when nothing depends
    // on `current`" gap).
    const [current] = await Promise.all([
      this.findCurrent(recordId),
      this.assertComponentIdsExist(patch.relatedComponentIds),
    ]);

    // archived/superseded are both terminal — content on a terminal row must never change, in
    // place or otherwise. Checked before the branch below rather than folded into it, since a CAS
    // guard alone wouldn't catch this case: a terminal row's own approvalStatus never changes
    // again, so a CAS scoped to "still archived"/"still superseded" would trivially always
    // succeed.
    if (current.approvalStatus === "archived" || current.approvalStatus === "superseded") {
      throw new BadRequestException(
        `Motion/interaction record ${recordId} is ${current.approvalStatus} and can no longer be edited`,
      );
    }

    if (current.approvalStatus !== "approved") {
      // A CAS guard on approvalStatus — without it, a concurrent approval landing between the
      // findCurrent() read above and this write would let this in-place edit silently land on
      // what is now an approved row, bypassing the "approved content is only ever forked into a
      // new version, never mutated in place" invariant the approved-branch below exists to
      // enforce.
      const updated = await this.records.updateInPlace(
        current.id,
        {
          ...patch,
          description: sanitizeNullableRichTextIfChanged(patch.description, current.description),
          triggerAndBehavior: sanitizeNullableRichTextIfChanged(
            patch.triggerAndBehavior,
            current.triggerAndBehavior,
          ),
          accessibilityNotes: sanitizeNullableRichTextIfChanged(
            patch.accessibilityNotes,
            current.accessibilityNotes,
          ),
          updatedBy: actorUserId,
        },
        undefined,
        current.approvalStatus,
      );
      if (!updated) {
        // 0 affected rows means either the row is genuinely gone (no hard-delete exists for this
        // module today, but this still guards a hypothetical future one) or — the real case this
        // guard exists for — its approvalStatus changed concurrently since the read above.
        // Distinguish the two with a fresh read rather than assuming either.
        const stillExists = await this.records.findCurrentByRecordId(recordId);
        if (!stillExists) {
          throw new NotFoundException(`Motion/interaction record not found: ${recordId}`);
        }
        throw new ConflictException(
          `Motion/interaction record ${recordId} approval status changed concurrently while editing — reload and retry`,
        );
      }

      await this.auditService.record({
        eventType: "data_change",
        actorUserId,
        actorType: "human",
        entityType: "motion_interaction_record",
        entityId: updated.id,
        action: "update",
        afterState: { ...patch },
        retentionCategory: "audit-7y",
      });

      return updated;
    }

    // The current version is approved — editing it creates a genuinely new version instead of
    // mutating it in place. Both writes (flipping the old row's isCurrent to false, and inserting
    // the new draft row) happen inside one transaction, mirroring
    // SectionPatternsService.update()'s/PageTemplatesService.update()'s own placement: the
    // SERVICE layer opens withTransaction() and threads the Transaction handle through multiple
    // separate repository calls.
    const nextVersionNumber = current.versionNumber + 1;
    let created: MotionInteractionRecordEntity;
    try {
      created = await withTransaction(async (transaction) => {
        // This CAS guard (also passing current.approvalStatus, matching the non-approved branch
        // above) closes a real race an edit-only caller could otherwise win — without it, a
        // concurrent approve->archived transition landing between the findCurrent() read above
        // and this write let the fork proceed anyway, resurrecting a just-archived record into a
        // fresh editable draft using only the "edit" grant, never "approve", for the resurrection
        // half of the race. archived/superseded are documented as permanently terminal — this
        // guard is what actually makes that true under concurrency, not just at the single
        // findCurrent() read.
        const flipped = await this.records.updateInPlace(
          current.id,
          { isCurrent: false, updatedBy: actorUserId },
          transaction,
          current.approvalStatus,
        );
        if (!flipped) {
          // No hard-delete exists for this module (belt-and-suspenders only, matching the
          // non-approved branch's own reasoning) — in practice this means the row's
          // approvalStatus changed concurrently (e.g. it was just archived), which is exactly
          // the race this guard exists to catch. A real re-check isn't possible from inside an
          // already-failing transaction, so this is reported as a conflict, the semantically
          // correct outcome for the only realistic cause.
          throw new ConflictException(
            `Motion/interaction record ${recordId} approval status changed concurrently while editing — reload and retry`,
          );
        }
        return this.records.createNewVersion(
          {
            recordId: current.recordId,
            publicId: current.publicId,
            category: current.category,
            versionNumber: nextVersionNumber,
            name: patch.name ?? current.name,
            description: sanitizeOrInherit(patch.description, current.description),
            triggerAndBehavior: sanitizeOrInherit(
              patch.triggerAndBehavior,
              current.triggerAndBehavior,
            ),
            timingAndEasing:
              patch.timingAndEasing !== undefined ? patch.timingAndEasing : current.timingAndEasing,
            implementationSpec:
              patch.implementationSpec !== undefined
                ? patch.implementationSpec
                : current.implementationSpec,
            accessibilityNotes: sanitizeOrInherit(
              patch.accessibilityNotes,
              current.accessibilityNotes,
            ),
            fallbackBehavior:
              patch.fallbackBehavior !== undefined
                ? patch.fallbackBehavior
                : current.fallbackBehavior,
            designReference:
              patch.designReference !== undefined ? patch.designReference : current.designReference,
            // undefined -> inherit current; explicit null or [] -> clear to []. Distinct from a
            // naive `patch.relatedComponentIds ?? current.relatedComponentIds`, which would
            // wrongly treat an explicit null the same as omission and silently keep the old
            // references instead of clearing them (mirrors PageTemplatesService.update()'s own
            // identical fix).
            relatedComponentIds:
              patch.relatedComponentIds !== undefined
                ? (patch.relatedComponentIds ?? [])
                : current.relatedComponentIds,
            createdBy: actorUserId,
          },
          transaction,
        );
      });
    } catch (error) {
      // Two concurrent edits of the same approved record can both read the identical
      // current.versionNumber before either transaction commits, so both compute the same
      // nextVersionNumber — the second createNewVersion() INSERT then collides on the
      // (record_id, version_number) unique index (migration 00086). Mirrors create()'s own
      // handling of the analogous publicId race a few methods above, but surfaces as a 409 (a
      // real concurrent-edit conflict), not a 400 (an input-validation error).
      if (isSequelizeUniqueConstraintError(error)) {
        throw new ConflictException(
          `Motion/interaction record ${recordId} was edited concurrently — reload and retry`,
        );
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "motion_interaction_record",
      entityId: created.id,
      action: "new_version",
      afterState: { ...patch, versionNumber: created.versionNumber },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async changeApprovalStatus(
    recordId: string,
    nextStatus: MotionInteractionApprovalStatus,
    actorUserId: string,
  ): Promise<MotionInteractionRecordEntity> {
    const current = await this.findCurrent(recordId);
    if (current.approvalStatus === nextStatus) {
      return current; // no-op, not an error — re-requesting the current status is harmless
    }

    const requiredAction = TRANSITIONS[current.approvalStatus][nextStatus];
    if (!requiredAction) {
      throw new BadRequestException(
        `Invalid motion/interaction approval status transition: ${current.approvalStatus} -> ${nextStatus}`,
      );
    }
    await this.authorizationService.assertAllowed(actorUserId, MODULE_KEY, requiredAction);

    const isApproval = nextStatus === "approved";

    // A successful "-> approved" transition additionally, atomically, flips the record's
    // previously-current-approved version (if one exists) to "superseded" — the CAS write and the
    // supersede write happen in the same transaction so both commit or roll back together.
    const result = isApproval
      ? await withTransaction(async (transaction) => {
          const casResult = await this.records.updateApprovalStatus(
            current.id,
            current.approvalStatus,
            nextStatus,
            actorUserId,
            transaction,
          );
          if (casResult.outcome === "updated") {
            await this.records.supersedeOtherApprovedVersion(
              current.recordId,
              current.id,
              actorUserId,
              transaction,
            );
          }
          return casResult;
        })
      : await this.records.updateApprovalStatus(
          current.id,
          current.approvalStatus,
          nextStatus,
          actorUserId,
        );

    if (result.outcome === "not_found") {
      throw new NotFoundException(`Motion/interaction record not found: ${recordId}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Motion/interaction record ${recordId} approval status changed concurrently ` +
          `(expected ${current.approvalStatus}, now ${result.entity.approvalStatus}) — reload and retry`,
      );
    }

    // A failed audit write here is caught and only console.error'd, not retried or alerted on —
    // the byte-identical, already-accepted pattern SectionPatternsService.changeApprovalStatus()/
    // PageTemplatesService.changeApprovalStatus()/DesignTokensService.changeApprovalStatus() all
    // have.
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        entityType: "motion_interaction_record",
        entityId: current.id,
        action: `status:${current.approvalStatus}->${nextStatus}`,
        beforeState: { approvalStatus: current.approvalStatus },
        afterState: { approvalStatus: nextStatus },
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Motion/interaction record ${recordId} approval status transition ` +
          `${current.approvalStatus}->${nextStatus} committed, but recording its audit event failed:`,
        error,
      );
    }

    return result.entity;
  }
}
