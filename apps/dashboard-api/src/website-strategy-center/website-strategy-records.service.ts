import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { withTransaction } from "@webdesk/database";
import { sanitizeNullableRichText, sanitizeNullableRichTextIfChanged } from "@webdesk/validation";
import type {
  WebsiteStrategyApprovalStatus,
  WebsiteStrategyRecordEntity,
  WebsiteStrategyRecordListFilter,
  WebsiteStrategyRecordRepository,
} from "@webdesk/database";
import { WEBSITE_STRATEGY_RECORD_REPOSITORY } from "./website-strategy-center.constants.js";
import type {
  CreateWebsiteStrategyRecordDto,
  UpdateWebsiteStrategyRecordDto,
} from "./website-strategy-center.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";

const MODULE_KEY = "website_strategy";

/** The real, seeded RBAC action (`06_Roles_and_Permissions.md`, `website_strategy` group)
 *  required for a given `approvalStatus` transition — identical vocabulary to Service Library's/
 *  Persona Library's/Proof and Claims Library's own. */
type WebsiteStrategyApprovalAction = "submit" | "review" | "approve";

/**
 * Sourced from `05_Workflow_State_Machines.md §2`'s generic artifact lifecycle, reused verbatim
 * from `ClaimsService`'s/`ServicesService`'s/`PersonasService`'s own (already code-reviewed)
 * `TRANSITIONS` table — a 4th occurrence of this identical shape, deliberately not extracted into
 * a shared helper (already-accepted, out-of-scope debt in this codebase, task package D6).
 * `submitted`/`revision_requested`/`rejected -> draft` all require `submit` (the submitter/editor
 * drives the revise-and-resubmit loop, not the approver). `archived`/`superseded` are both
 * terminal — no code path resurrects a record from either.
 *
 * Deliberately DIFFERENT from the sibling copy of this table on one entry: `approved` has no
 * `superseded` edge here. Unlike Service/Persona/Proof-and-Claims Library, where a caller with
 * the `approve` grant may legitimately request `approved -> superseded` directly, this module's
 * own design (this file's `changeApprovalStatus()`, and `supersedeOtherApprovedVersion()`'s own
 * doc comment in the repository) states "supersede" is never a distinct user action — it only
 * ever happens as an automatic side effect of a DIFFERENT version's own `-> approved` transition
 * succeeding (see the `isApproval` branch below, which calls `supersedeOtherApprovedVersion()`
 * directly, bypassing this table entirely). Leaving the `superseded` edge in this table let a
 * caller mark a record's sole approved version "superseded" with no successor ever having
 * existed — a code-review-confirmed bug, fixed by removing the edge so a direct request is
 * rejected the same way any other invalid transition is.
 */
const TRANSITIONS: Readonly<
  Record<
    WebsiteStrategyApprovalStatus,
    Readonly<Partial<Record<WebsiteStrategyApprovalStatus, WebsiteStrategyApprovalAction>>>
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
export class WebsiteStrategyRecordsService {
  constructor(
    @Inject(WEBSITE_STRATEGY_RECORD_REPOSITORY)
    private readonly records: WebsiteStrategyRecordRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    input: CreateWebsiteStrategyRecordDto,
    actorUserId: string,
  ): Promise<WebsiteStrategyRecordEntity> {
    const existing = await this.records.findCurrentByPublicId(input.publicId);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: WebsiteStrategyRecordEntity;
    try {
      created = await this.records.create({
        publicId: input.publicId,
        recordType: input.recordType,
        title: input.title,
        content: sanitizeNullableRichText(input.content),
        notes: sanitizeNullableRichText(input.notes),
        createdBy: actorUserId,
      });
    } catch (error) {
      // The publicId uniqueness check above is TOCTOU (two concurrent creates of NEW records
      // with the same publicId can both pass it before either INSERT commits — the partial
      // unique index is `WHERE is_current = true`, so this is specifically a race between two
      // brand-new records, not a version-creation race) — the real unique index catches the race
      // loser, but without this catch it would otherwise surface as a raw 500 instead of the same
      // clean 400 the check above already gives the non-racing caller. Checked by `.name`, not
      // `instanceof`, since `dashboard-api` never imports `sequelize` directly (ADR-0006/
      // `only-database-package-touches-sequelize` — only `packages/database` may) —
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
      entityType: "website_strategy_record",
      entityId: created.id,
      action: "create",
      afterState: { title: created.title, recordType: created.recordType },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  /** The CURRENT version of a record, by its stable `recordId` — not a row `id`. */
  async findCurrent(recordId: string): Promise<WebsiteStrategyRecordEntity> {
    const current = await this.records.findCurrentByRecordId(recordId);
    if (!current) {
      throw new NotFoundException(`Website strategy record not found: ${recordId}`);
    }
    return current;
  }

  /** Every version of a record, oldest first. A `recordId` that has never existed at all (zero
   *  rows) is a clean 404 — distinct from the repository's own empty-array return, which this
   *  method turns into the right exception rather than leaking an empty list for an unknown id. */
  async listVersions(recordId: string): Promise<readonly WebsiteStrategyRecordEntity[]> {
    const versions = await this.records.listVersions(recordId);
    if (versions.length === 0) {
      throw new NotFoundException(`Website strategy record not found: ${recordId}`);
    }
    return versions;
  }

  async list(
    filter: WebsiteStrategyRecordListFilter,
  ): Promise<readonly WebsiteStrategyRecordEntity[]> {
    return this.records.list(filter);
  }

  /**
   * Task package D3/D4 — updates the CURRENT version. If it is NOT `approved`, mutates that same
   * row in place (matching every sibling module's own `update()`). If it IS `approved`, creates a
   * new draft version instead — `recordType`/`publicId` are copied forward unchanged (immutable
   * across a record's own version chain), and any field the patch omits falls back to the current
   * version's own stored value. The response's own `versionNumber`/`isCurrent`/`id` naturally
   * reveal which path was taken (a new version is, unavoidably, a different row) — no special
   * response wrapper is needed.
   */
  async update(
    recordId: string,
    patch: UpdateWebsiteStrategyRecordDto,
    actorUserId: string,
  ): Promise<WebsiteStrategyRecordEntity> {
    const current = await this.findCurrent(recordId);

    // archived/superseded are both terminal (see TRANSITIONS's own doc comment — "no code path
    // resurrects a record from either") — content on a terminal row must never change, in place
    // or otherwise. Checked before the branch below rather than folded into it, since a CAS guard
    // alone wouldn't catch this case: a terminal row's own approvalStatus never changes again, so
    // a CAS scoped to "still archived"/"still superseded" would trivially always succeed.
    if (current.approvalStatus === "archived" || current.approvalStatus === "superseded") {
      throw new BadRequestException(
        `Website strategy record ${recordId} is ${current.approvalStatus} and can no longer be edited`,
      );
    }

    if (current.approvalStatus !== "approved") {
      // A CAS guard on approvalStatus (code-review finding) — without it, a concurrent approval
      // landing between the findCurrent() read above and this write would let this in-place edit
      // silently land on what is now an approved row, bypassing the "approved content is only
      // ever forked into a new version, never mutated in place" invariant the approved-branch
      // below exists to enforce.
      const updated = await this.records.updateInPlace(
        current.id,
        {
          ...patch,
          content: sanitizeNullableRichTextIfChanged(patch.content, current.content),
          notes: sanitizeNullableRichTextIfChanged(patch.notes, current.notes),
          updatedBy: actorUserId,
        },
        undefined,
        current.approvalStatus,
      );
      if (!updated) {
        // 0 affected rows means either the row is genuinely gone (no hard-delete exists for this
        // module today, but this still guards a hypothetical future one, matching
        // ProofClaimRepository's/PersonaRepository's own identical belt-and-suspenders check) or
        // — the real case this guard exists for — its approvalStatus changed concurrently since
        // the read above. Distinguish the two with a fresh read rather than assuming either.
        const stillExists = await this.records.findCurrentByRecordId(recordId);
        if (!stillExists) {
          throw new NotFoundException(`Website strategy record not found: ${recordId}`);
        }
        throw new ConflictException(
          `Website strategy record ${recordId} approval status changed concurrently while editing — reload and retry`,
        );
      }

      await this.auditService.record({
        eventType: "data_change",
        actorUserId,
        actorType: "human",
        entityType: "website_strategy_record",
        entityId: updated.id,
        action: "update",
        afterState: { ...patch },
        retentionCategory: "audit-7y",
      });

      return updated;
    }

    // The current version is approved — editing it creates a genuinely new version instead of
    // mutating it in place (task package D2/D3). Both writes (flipping the old row's isCurrent
    // to false, and inserting the new draft row) happen inside one transaction, mirroring
    // ProjectService.setActivePhase()'s own placement: the SERVICE layer opens withTransaction()
    // and threads the Transaction handle through multiple separate repository calls.
    const nextVersionNumber = current.versionNumber + 1;
    let created: WebsiteStrategyRecordEntity;
    try {
      created = await withTransaction(async (transaction) => {
        // Security-review fix: this CAS guard (also passing current.approvalStatus, matching the
        // non-approved branch above) closes a real race an edit-only caller could otherwise win —
        // without it, a concurrent approve->archived transition landing between the findCurrent()
        // read above and this write let the fork proceed anyway, resurrecting a just-archived
        // record into a fresh editable draft using only the "edit" grant, never "approve", for
        // the resurrection half of the race. archived/superseded are documented as permanently
        // terminal ("no code path resurrects a record from either") — this guard is what actually
        // makes that true under concurrency, not just at the single findCurrent() read.
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
            `Website strategy record ${recordId} approval status changed concurrently while editing — reload and retry`,
          );
        }
        return this.records.createNewVersion(
          {
            recordId: current.recordId,
            publicId: current.publicId,
            recordType: current.recordType,
            versionNumber: nextVersionNumber,
            title: patch.title ?? current.title,
            // An omitted field inherits the current version's own value, which was already
            // sanitized when it was first written — re-sanitizing it here would be redundant
            // (the same skip-if-unchanged reasoning `sanitizeNullableRichTextIfChanged()`
            // applies elsewhere), so only a genuinely NEW value from the patch is sanitized
            // fresh. `createNewVersion()`'s `content`/`notes` are non-optional (`string | null`,
            // never `undefined`) since it inserts a whole new row, so this can't reuse
            // `sanitizeNullableRichTextIfChanged()` directly the way the in-place branch above
            // does.
            content:
              patch.content !== undefined
                ? (sanitizeNullableRichText(patch.content) ?? null)
                : current.content,
            notes:
              patch.notes !== undefined
                ? (sanitizeNullableRichText(patch.notes) ?? null)
                : current.notes,
            createdBy: actorUserId,
          },
          transaction,
        );
      });
    } catch (error) {
      // Two concurrent edits of the same approved record can both read the identical
      // current.versionNumber before either transaction commits, so both compute the same
      // nextVersionNumber — the second createNewVersion() INSERT then collides on the
      // (record_id, version_number) unique index (migration 00056). Mirrors create()'s own
      // handling of the analogous publicId race a few methods above, but surfaces as a 409 (a
      // real concurrent-edit conflict), not a 400 (an input-validation error) — checked by
      // `.name`, not `instanceof`, since dashboard-api never imports sequelize directly
      // (ADR-0006).
      if (error instanceof Error && error.name === "SequelizeUniqueConstraintError") {
        throw new ConflictException(
          `Website strategy record ${recordId} was edited concurrently — reload and retry`,
        );
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "website_strategy_record",
      entityId: created.id,
      action: "new_version",
      afterState: { ...patch, versionNumber: created.versionNumber },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async changeApprovalStatus(
    recordId: string,
    nextStatus: WebsiteStrategyApprovalStatus,
    actorUserId: string,
  ): Promise<WebsiteStrategyRecordEntity> {
    const current = await this.findCurrent(recordId);
    if (current.approvalStatus === nextStatus) {
      return current; // no-op, not an error — re-requesting the current status is harmless
    }

    const requiredAction = TRANSITIONS[current.approvalStatus][nextStatus];
    if (!requiredAction) {
      throw new BadRequestException(
        `Invalid website strategy approval status transition: ${current.approvalStatus} -> ${nextStatus}`,
      );
    }
    await this.authorizationService.assertAllowed(actorUserId, MODULE_KEY, requiredAction);

    const isApproval = nextStatus === "approved";

    // A successful "-> approved" transition additionally, atomically, flips the record's
    // previously-current-approved version (if one exists) to "superseded" (task package D4) — the
    // CAS write and the supersede write happen in the same transaction so both commit or roll
    // back together.
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
      throw new NotFoundException(`Website strategy record not found: ${recordId}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Website strategy record ${recordId} approval status changed concurrently ` +
          `(expected ${current.approvalStatus}, now ${result.entity.approvalStatus}) — reload and retry`,
      );
    }

    // A failed audit write here is caught and only console.error'd, not retried or alerted on —
    // the byte-identical, already-accepted pattern ClaimsService.changeApprovalStatus()/
    // PersonasService.changeApprovalStatus()/ServicesService.changeApprovalStatus() all have.
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        entityType: "website_strategy_record",
        entityId: current.id,
        action: `status:${current.approvalStatus}->${nextStatus}`,
        beforeState: { approvalStatus: current.approvalStatus },
        afterState: { approvalStatus: nextStatus },
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Website strategy record ${recordId} approval status transition ` +
          `${current.approvalStatus}->${nextStatus} committed, but recording its audit event failed:`,
        error,
      );
    }

    return result.entity;
  }
}
