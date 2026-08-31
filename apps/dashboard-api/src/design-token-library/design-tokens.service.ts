import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { withTransaction } from "@webdesk/database";
import type {
  DesignTokenApprovalStatus,
  DesignTokenEntity,
  DesignTokenListFilter,
  DesignTokenRepository,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import { DESIGN_TOKEN_REPOSITORY, MODULE_KEY } from "./design-token-library.constants.js";
import type { CreateDesignTokenDto, UpdateDesignTokenDto } from "./design-token-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";

/** The real, seeded RBAC action (`06_Roles_and_Permissions.md`, `creative_design` group)
 *  required for a given `approvalStatus` transition — identical vocabulary to Website Strategy
 *  Center's/Service Library's/Persona Library's/Proof and Claims Library's own. */
type DesignTokenApprovalAction = "submit" | "review" | "approve";

/**
 * Sourced from `05_Workflow_State_Machines.md §2`'s generic artifact lifecycle, reused verbatim
 * from `WebsiteStrategyRecordsService`'s/`ClaimsService`'s/`ServicesService`'s/`PersonasService`'s
 * own (already code-reviewed) `TRANSITIONS` table — a 5th occurrence of this identical shape,
 * deliberately not extracted into a shared helper (already-accepted, out-of-scope debt in this
 * codebase). `submitted`/`revision_requested`/`rejected -> draft` all require `submit` (the
 * submitter/editor drives the revise-and-resubmit loop, not the approver). `archived`/`superseded`
 * are both terminal — no code path resurrects a record from either.
 *
 * Mirrors Website Strategy Center's own table exactly, including its one deliberate deviation
 * from the Service/Persona/Proof-and-Claims Library copies: `approved` has no `superseded` edge
 * here either — "supersede" is never a distinct user action for a version-history module. It only
 * ever happens as an automatic side effect of a DIFFERENT version's own `-> approved` transition
 * succeeding (see the `isApproval` branch below, which calls `supersedeOtherApprovedVersion()`
 * directly, bypassing this table entirely).
 */
const TRANSITIONS: Readonly<
  Record<
    DesignTokenApprovalStatus,
    Readonly<Partial<Record<DesignTokenApprovalStatus, DesignTokenApprovalAction>>>
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
export class DesignTokensService {
  constructor(
    @Inject(DESIGN_TOKEN_REPOSITORY)
    private readonly tokens: DesignTokenRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  async create(input: CreateDesignTokenDto, actorUserId: string): Promise<DesignTokenEntity> {
    const existing = await this.tokens.findCurrentByPublicId(input.publicId);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: DesignTokenEntity;
    try {
      created = await this.tokens.create({
        publicId: input.publicId,
        group: input.group,
        name: input.name,
        value: input.value,
        unit: input.unit ?? null,
        semanticPurpose: input.semanticPurpose ?? null,
        responsiveVariation: input.responsiveVariation ?? null,
        themeVariation: input.themeVariation ?? null,
        usageReferences: input.usageReferences ?? [],
        createdBy: actorUserId,
      });
    } catch (error) {
      // The publicId uniqueness check above is TOCTOU (two concurrent creates of NEW records
      // with the same publicId can both pass it before either INSERT commits — the partial
      // unique index is `WHERE is_current = true`, so this is specifically a race between two
      // brand-new records, not a version-creation race) — the real unique index catches the race
      // loser, but without this catch it would otherwise surface as a raw 500 instead of the same
      // clean 400 the check above already gives the non-racing caller. Uses the shared
      // `isSequelizeUniqueConstraintError()` helper (`@webdesk/validation`, already used by
      // Page Inventory/Brand Library/Design Reference Library and others), not a hand-rolled
      // `.name` check (code-review fix).
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(`publicId already in use: ${input.publicId}`);
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "design_token",
      entityId: created.id,
      action: "create",
      afterState: { name: created.name, group: created.group },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  /**
   * A narrow, read-only delegating method for other modules validating a `tokenIds`-style field
   * against real design tokens (Component Library) — returns only the subset of `ids` that
   * resolve to a real, current token, never a full `DesignTokenEntity`. Exists so
   * `DesignTokenLibraryModule` can export just `DesignTokensService`, not the write-capable
   * `DESIGN_TOKEN_REPOSITORY` token directly (mirrors `ServicesService.existingServiceIds()`'s
   * own already-reviewed pattern — the exact "surface grows" condition Persona Library's own
   * security review flagged once already, applied here from the start rather than reactively).
   */
  async existingTokenIds(ids: readonly string[]): Promise<ReadonlySet<string>> {
    const found = await this.tokens.findByIds(ids);
    return new Set(found.map((row) => row.recordId));
  }

  /** The CURRENT version of a record, by its stable `recordId` — not a row `id`. */
  async findCurrent(recordId: string): Promise<DesignTokenEntity> {
    const current = await this.tokens.findCurrentByRecordId(recordId);
    if (!current) {
      throw new NotFoundException(`Design token not found: ${recordId}`);
    }
    return current;
  }

  /** Every version of a record, oldest first. A `recordId` that has never existed at all (zero
   *  rows) is a clean 404 — distinct from the repository's own empty-array return, which this
   *  method turns into the right exception rather than leaking an empty list for an unknown id. */
  async listVersions(recordId: string): Promise<readonly DesignTokenEntity[]> {
    const versions = await this.tokens.listVersions(recordId);
    if (versions.length === 0) {
      throw new NotFoundException(`Design token not found: ${recordId}`);
    }
    return versions;
  }

  async list(filter: DesignTokenListFilter): Promise<readonly DesignTokenEntity[]> {
    return this.tokens.list(filter);
  }

  /**
   * Updates the CURRENT version. If it is NOT `approved`, mutates that same row in place
   * (matching every sibling module's own `update()`). If it IS `approved`, creates a new draft
   * version instead — `group`/`publicId` are copied forward unchanged (immutable across a
   * record's own version chain), and any field the patch omits falls back to the current
   * version's own stored value. The response's own `versionNumber`/`isCurrent`/`id` naturally
   * reveal which path was taken (a new version is, unavoidably, a different row) — no special
   * response wrapper is needed.
   */
  async update(
    recordId: string,
    patch: UpdateDesignTokenDto,
    actorUserId: string,
  ): Promise<DesignTokenEntity> {
    const current = await this.findCurrent(recordId);

    // archived/superseded are both terminal — content on a terminal row must never change, in
    // place or otherwise. Checked before the branch below rather than folded into it, since a CAS
    // guard alone wouldn't catch this case: a terminal row's own approvalStatus never changes
    // again, so a CAS scoped to "still archived"/"still superseded" would trivially always
    // succeed.
    if (current.approvalStatus === "archived" || current.approvalStatus === "superseded") {
      throw new BadRequestException(
        `Design token ${recordId} is ${current.approvalStatus} and can no longer be edited`,
      );
    }

    if (current.approvalStatus !== "approved") {
      // A CAS guard on approvalStatus — without it, a concurrent approval landing between the
      // findCurrent() read above and this write would let this in-place edit silently land on
      // what is now an approved row, bypassing the "approved content is only ever forked into a
      // new version, never mutated in place" invariant the approved-branch below exists to
      // enforce.
      const updated = await this.tokens.updateInPlace(
        current.id,
        { ...patch, updatedBy: actorUserId },
        undefined,
        current.approvalStatus,
      );
      if (!updated) {
        // 0 affected rows means either the row is genuinely gone (no hard-delete exists for this
        // module today, but this still guards a hypothetical future one) or — the real case this
        // guard exists for — its approvalStatus changed concurrently since the read above.
        // Distinguish the two with a fresh read rather than assuming either.
        const stillExists = await this.tokens.findCurrentByRecordId(recordId);
        if (!stillExists) {
          throw new NotFoundException(`Design token not found: ${recordId}`);
        }
        throw new ConflictException(
          `Design token ${recordId} approval status changed concurrently while editing — reload and retry`,
        );
      }

      await this.auditService.record({
        eventType: "data_change",
        actorUserId,
        actorType: "human",
        entityType: "design_token",
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
    // WebsiteStrategyRecordsService.update()'s own placement: the SERVICE layer opens
    // withTransaction() and threads the Transaction handle through multiple separate repository
    // calls.
    const nextVersionNumber = current.versionNumber + 1;
    let created: DesignTokenEntity;
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
        const flipped = await this.tokens.updateInPlace(
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
            `Design token ${recordId} approval status changed concurrently while editing — reload and retry`,
          );
        }
        return this.tokens.createNewVersion(
          {
            recordId: current.recordId,
            publicId: current.publicId,
            group: current.group,
            versionNumber: nextVersionNumber,
            name: patch.name ?? current.name,
            value: patch.value ?? current.value,
            unit: patch.unit !== undefined ? patch.unit : current.unit,
            semanticPurpose:
              patch.semanticPurpose !== undefined ? patch.semanticPurpose : current.semanticPurpose,
            responsiveVariation:
              patch.responsiveVariation !== undefined
                ? patch.responsiveVariation
                : current.responsiveVariation,
            themeVariation:
              patch.themeVariation !== undefined ? patch.themeVariation : current.themeVariation,
            // undefined -> inherit current; explicit null or [] -> clear to []. Distinct from a
            // naive `patch.usageReferences ?? current.usageReferences`, which would wrongly treat
            // an explicit null the same as omission and silently keep the old references instead
            // of clearing them (code-review fix).
            usageReferences:
              patch.usageReferences !== undefined
                ? (patch.usageReferences ?? [])
                : current.usageReferences,
            createdBy: actorUserId,
          },
          transaction,
        );
      });
    } catch (error) {
      // Two concurrent edits of the same approved record can both read the identical
      // current.versionNumber before either transaction commits, so both compute the same
      // nextVersionNumber — the second createNewVersion() INSERT then collides on the
      // (record_id, version_number) unique index (migration 00076). Mirrors create()'s own
      // handling of the analogous publicId race a few methods above, but surfaces as a 409 (a
      // real concurrent-edit conflict), not a 400 (an input-validation error) — uses the shared
      // `isSequelizeUniqueConstraintError()` helper (code-review fix).
      if (isSequelizeUniqueConstraintError(error)) {
        throw new ConflictException(
          `Design token ${recordId} was edited concurrently — reload and retry`,
        );
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "design_token",
      entityId: created.id,
      action: "new_version",
      afterState: { ...patch, versionNumber: created.versionNumber },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async changeApprovalStatus(
    recordId: string,
    nextStatus: DesignTokenApprovalStatus,
    actorUserId: string,
  ): Promise<DesignTokenEntity> {
    const current = await this.findCurrent(recordId);
    if (current.approvalStatus === nextStatus) {
      return current; // no-op, not an error — re-requesting the current status is harmless
    }

    const requiredAction = TRANSITIONS[current.approvalStatus][nextStatus];
    if (!requiredAction) {
      throw new BadRequestException(
        `Invalid design token approval status transition: ${current.approvalStatus} -> ${nextStatus}`,
      );
    }
    await this.authorizationService.assertAllowed(actorUserId, MODULE_KEY, requiredAction);

    const isApproval = nextStatus === "approved";

    // A successful "-> approved" transition additionally, atomically, flips the record's
    // previously-current-approved version (if one exists) to "superseded" — the CAS write and the
    // supersede write happen in the same transaction so both commit or roll back together.
    const result = isApproval
      ? await withTransaction(async (transaction) => {
          const casResult = await this.tokens.updateApprovalStatus(
            current.id,
            current.approvalStatus,
            nextStatus,
            actorUserId,
            transaction,
          );
          if (casResult.outcome === "updated") {
            await this.tokens.supersedeOtherApprovedVersion(
              current.recordId,
              current.id,
              actorUserId,
              transaction,
            );
          }
          return casResult;
        })
      : await this.tokens.updateApprovalStatus(
          current.id,
          current.approvalStatus,
          nextStatus,
          actorUserId,
        );

    if (result.outcome === "not_found") {
      throw new NotFoundException(`Design token not found: ${recordId}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Design token ${recordId} approval status changed concurrently ` +
          `(expected ${current.approvalStatus}, now ${result.entity.approvalStatus}) — reload and retry`,
      );
    }

    // A failed audit write here is caught and only console.error'd, not retried or alerted on —
    // the byte-identical, already-accepted pattern
    // WebsiteStrategyRecordsService.changeApprovalStatus()/ClaimsService.changeApprovalStatus()/
    // PersonasService.changeApprovalStatus()/ServicesService.changeApprovalStatus() all have.
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        entityType: "design_token",
        entityId: current.id,
        action: `status:${current.approvalStatus}->${nextStatus}`,
        beforeState: { approvalStatus: current.approvalStatus },
        afterState: { approvalStatus: nextStatus },
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Design token ${recordId} approval status transition ` +
          `${current.approvalStatus}->${nextStatus} committed, but recording its audit event failed:`,
        error,
      );
    }

    return result.entity;
  }
}
