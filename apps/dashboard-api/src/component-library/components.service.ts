import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { withTransaction } from "@webdesk/database";
import type {
  ComponentApprovalStatus,
  ComponentEntity,
  ComponentListFilter,
  ComponentRepository,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import { COMPONENT_REPOSITORY, MODULE_KEY } from "./component-library.constants.js";
import type { CreateComponentDto, UpdateComponentDto } from "./component-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { DesignTokensService } from "../design-token-library/design-tokens.service.js";

/** The real, seeded RBAC action (`06_Roles_and_Permissions.md`, `creative_design` group)
 *  required for a given `approvalStatus` transition — identical vocabulary to Design Token
 *  Library's/Website Strategy Center's/Service Library's/Persona Library's/Proof and Claims
 *  Library's own. */
type ComponentApprovalAction = "submit" | "review" | "approve";

/**
 * Sourced from `05_Workflow_State_Machines.md §2`'s generic artifact lifecycle, reused verbatim
 * from `DesignTokensService`'s/`WebsiteStrategyRecordsService`'s/`ClaimsService`'s/
 * `ServicesService`'s/`PersonasService`'s own (already code-reviewed) `TRANSITIONS` table — a 6th
 * occurrence of this identical shape, deliberately not extracted into a shared helper (already-
 * accepted, out-of-scope debt in this codebase). `submitted`/`revision_requested`/
 * `rejected -> draft` all require `submit` (the submitter/editor drives the revise-and-resubmit
 * loop, not the approver). `archived`/`superseded` are both terminal — no code path resurrects a
 * record from either.
 *
 * Mirrors Design Token Library's own table exactly, including its one deliberate deviation from
 * the Service/Persona/Proof-and-Claims Library copies: `approved` has no `superseded` edge here
 * either — "supersede" is never a distinct user action for a version-history module. It only ever
 * happens as an automatic side effect of a DIFFERENT version's own `-> approved` transition
 * succeeding (see the `isApproval` branch below, which calls `supersedeOtherApprovedVersion()`
 * directly, bypassing this table entirely).
 */
const TRANSITIONS: Readonly<
  Record<
    ComponentApprovalStatus,
    Readonly<Partial<Record<ComponentApprovalStatus, ComponentApprovalAction>>>
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
export class ComponentsService {
  constructor(
    @Inject(COMPONENT_REPOSITORY)
    private readonly components: ComponentRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
    private readonly designTokensService: DesignTokensService,
  ) {}

  /** `tokenIds` entries must resolve to a real, current design token (design decision 2) — the
   *  DTO already guarantees well-formed UUID strings via `z.string().uuid()`, so no malformed-id
   *  filtering is needed here (unlike Persona Library's own equivalent, whose `idListField` isn't
   *  UUID-shaped at the schema layer). */
  private async assertTokenIdsExist(ids: readonly string[] | null | undefined): Promise<void> {
    if (!ids || ids.length === 0) {
      return;
    }
    const foundIds = await this.designTokensService.existingTokenIds(ids);
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`tokenIds not found: ${missing.join(", ")}`);
    }
  }

  /** `replacementRecordId` must resolve to a real, current component of THIS module (an
   *  in-module self-reference, unlike `tokenIds`) — deliberately not checked against the record
   *  being created/updated itself (a component replacing itself is nonsensical but not actively
   *  dangerous; left unenforced rather than adding a self-reference guard no caller has asked
   *  for). */
  private async assertReplacementExists(id: string | null | undefined): Promise<void> {
    if (!id) {
      return;
    }
    const found = await this.components.findCurrentByRecordId(id);
    if (!found) {
      throw new BadRequestException(`replacementRecordId not found: ${id}`);
    }
  }

  async create(input: CreateComponentDto, actorUserId: string): Promise<ComponentEntity> {
    // Independent checks (different tables/queries, none consumes another's result) — run
    // concurrently rather than as sequential round trips (mirrors PersonasService.create()'s own
    // Promise.all reasoning).
    const [existing] = await Promise.all([
      this.components.findCurrentByPublicId(input.publicId),
      this.assertTokenIdsExist(input.tokenIds),
      this.assertReplacementExists(input.replacementRecordId),
    ]);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: ComponentEntity;
    try {
      created = await this.components.create({
        publicId: input.publicId,
        category: input.category,
        name: input.name,
        figmaReference: input.figmaReference ?? null,
        tokenIds: input.tokenIds ?? [],
        htmlStructure: input.htmlStructure ?? null,
        phpPath: input.phpPath ?? null,
        scssClassesPath: input.scssClassesPath ?? null,
        jsDependencies: input.jsDependencies ?? null,
        states: input.states ?? null,
        responsiveBehavior: input.responsiveBehavior ?? null,
        browserSupport: input.browserSupport ?? null,
        accessibility: input.accessibility ?? null,
        schema: input.schema ?? null,
        analytics: input.analytics ?? null,
        tests: input.tests ?? null,
        replacementRecordId: input.replacementRecordId ?? null,
        createdBy: actorUserId,
      });
    } catch (error) {
      // The publicId uniqueness check above is TOCTOU (two concurrent creates of NEW records with
      // the same publicId can both pass it before either INSERT commits — the partial unique
      // index is `WHERE is_current = true`, so this is specifically a race between two brand-new
      // records, not a version-creation race) — the real unique index catches the race loser, but
      // without this catch it would otherwise surface as a raw 500 instead of the same clean 400
      // the check above already gives the non-racing caller. Uses the shared
      // `isSequelizeUniqueConstraintError()` helper (`@webdesk/validation`), not a hand-rolled
      // `.name` check.
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(`publicId already in use: ${input.publicId}`);
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "component",
      entityId: created.id,
      action: "create",
      afterState: { name: created.name, category: created.category },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  /** The CURRENT version of a record, by its stable `recordId` — not a row `id`. */
  async findCurrent(recordId: string): Promise<ComponentEntity> {
    const current = await this.components.findCurrentByRecordId(recordId);
    if (!current) {
      throw new NotFoundException(`Component not found: ${recordId}`);
    }
    return current;
  }

  /** Every version of a record, oldest first. A `recordId` that has never existed at all (zero
   *  rows) is a clean 404 — distinct from the repository's own empty-array return, which this
   *  method turns into the right exception rather than leaking an empty list for an unknown id. */
  async listVersions(recordId: string): Promise<readonly ComponentEntity[]> {
    const versions = await this.components.listVersions(recordId);
    if (versions.length === 0) {
      throw new NotFoundException(`Component not found: ${recordId}`);
    }
    return versions;
  }

  async list(filter: ComponentListFilter): Promise<readonly ComponentEntity[]> {
    return this.components.list(filter);
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
    patch: UpdateComponentDto,
    actorUserId: string,
  ): Promise<ComponentEntity> {
    // Independent of the current-row read below — run concurrently (mirrors
    // PersonasService.update()'s own fix for the identical "sequential when nothing depends on
    // `current`" gap).
    const [current] = await Promise.all([
      this.findCurrent(recordId),
      this.assertTokenIdsExist(patch.tokenIds),
      this.assertReplacementExists(patch.replacementRecordId),
    ]);

    // archived/superseded are both terminal — content on a terminal row must never change, in
    // place or otherwise. Checked before the branch below rather than folded into it, since a CAS
    // guard alone wouldn't catch this case: a terminal row's own approvalStatus never changes
    // again, so a CAS scoped to "still archived"/"still superseded" would trivially always
    // succeed.
    if (current.approvalStatus === "archived" || current.approvalStatus === "superseded") {
      throw new BadRequestException(
        `Component ${recordId} is ${current.approvalStatus} and can no longer be edited`,
      );
    }

    if (current.approvalStatus !== "approved") {
      // A CAS guard on approvalStatus — without it, a concurrent approval landing between the
      // findCurrent() read above and this write would let this in-place edit silently land on
      // what is now an approved row, bypassing the "approved content is only ever forked into a
      // new version, never mutated in place" invariant the approved-branch below exists to
      // enforce.
      const updated = await this.components.updateInPlace(
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
        const stillExists = await this.components.findCurrentByRecordId(recordId);
        if (!stillExists) {
          throw new NotFoundException(`Component not found: ${recordId}`);
        }
        throw new ConflictException(
          `Component ${recordId} approval status changed concurrently while editing — reload and retry`,
        );
      }

      await this.auditService.record({
        eventType: "data_change",
        actorUserId,
        actorType: "human",
        entityType: "component",
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
    // DesignTokensService.update()'s own placement: the SERVICE layer opens withTransaction() and
    // threads the Transaction handle through multiple separate repository calls.
    const nextVersionNumber = current.versionNumber + 1;
    let created: ComponentEntity;
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
        const flipped = await this.components.updateInPlace(
          current.id,
          { isCurrent: false, updatedBy: actorUserId },
          transaction,
          current.approvalStatus,
        );
        if (!flipped) {
          // No hard-delete exists for this module (belt-and-suspenders only, matching the
          // non-approved branch's own reasoning) — in practice this means the row's
          // approvalStatus changed concurrently (e.g. it was just archived), which is exactly the
          // race this guard exists to catch. A real re-check isn't possible from inside an
          // already-failing transaction, so this is reported as a conflict, the semantically
          // correct outcome for the only realistic cause.
          throw new ConflictException(
            `Component ${recordId} approval status changed concurrently while editing — reload and retry`,
          );
        }
        return this.components.createNewVersion(
          {
            recordId: current.recordId,
            publicId: current.publicId,
            category: current.category,
            versionNumber: nextVersionNumber,
            name: patch.name ?? current.name,
            figmaReference:
              patch.figmaReference !== undefined ? patch.figmaReference : current.figmaReference,
            // undefined -> inherit current; explicit null or [] -> clear to []. Distinct from a
            // naive `patch.tokenIds ?? current.tokenIds`, which would wrongly treat an explicit
            // null the same as omission and silently keep the old references instead of clearing
            // them (mirrors DesignTokensService.update()'s own identical fix).
            tokenIds: patch.tokenIds !== undefined ? (patch.tokenIds ?? []) : current.tokenIds,
            htmlStructure:
              patch.htmlStructure !== undefined ? patch.htmlStructure : current.htmlStructure,
            phpPath: patch.phpPath !== undefined ? patch.phpPath : current.phpPath,
            scssClassesPath:
              patch.scssClassesPath !== undefined ? patch.scssClassesPath : current.scssClassesPath,
            jsDependencies:
              patch.jsDependencies !== undefined ? patch.jsDependencies : current.jsDependencies,
            states: patch.states !== undefined ? patch.states : current.states,
            responsiveBehavior:
              patch.responsiveBehavior !== undefined
                ? patch.responsiveBehavior
                : current.responsiveBehavior,
            browserSupport:
              patch.browserSupport !== undefined ? patch.browserSupport : current.browserSupport,
            accessibility:
              patch.accessibility !== undefined ? patch.accessibility : current.accessibility,
            schema: patch.schema !== undefined ? patch.schema : current.schema,
            analytics: patch.analytics !== undefined ? patch.analytics : current.analytics,
            tests: patch.tests !== undefined ? patch.tests : current.tests,
            replacementRecordId:
              patch.replacementRecordId !== undefined
                ? patch.replacementRecordId
                : current.replacementRecordId,
            createdBy: actorUserId,
          },
          transaction,
        );
      });
    } catch (error) {
      // Two concurrent edits of the same approved record can both read the identical
      // current.versionNumber before either transaction commits, so both compute the same
      // nextVersionNumber — the second createNewVersion() INSERT then collides on the
      // (record_id, version_number) unique index (migration 00078). Mirrors create()'s own
      // handling of the analogous publicId race a few methods above, but surfaces as a 409 (a
      // real concurrent-edit conflict), not a 400 (an input-validation error).
      if (isSequelizeUniqueConstraintError(error)) {
        throw new ConflictException(
          `Component ${recordId} was edited concurrently — reload and retry`,
        );
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "component",
      entityId: created.id,
      action: "new_version",
      afterState: { ...patch, versionNumber: created.versionNumber },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async changeApprovalStatus(
    recordId: string,
    nextStatus: ComponentApprovalStatus,
    actorUserId: string,
  ): Promise<ComponentEntity> {
    const current = await this.findCurrent(recordId);
    if (current.approvalStatus === nextStatus) {
      return current; // no-op, not an error — re-requesting the current status is harmless
    }

    const requiredAction = TRANSITIONS[current.approvalStatus][nextStatus];
    if (!requiredAction) {
      throw new BadRequestException(
        `Invalid component approval status transition: ${current.approvalStatus} -> ${nextStatus}`,
      );
    }
    await this.authorizationService.assertAllowed(actorUserId, MODULE_KEY, requiredAction);

    const isApproval = nextStatus === "approved";

    // A successful "-> approved" transition additionally, atomically, flips the record's
    // previously-current-approved version (if one exists) to "superseded" — the CAS write and the
    // supersede write happen in the same transaction so both commit or roll back together.
    const result = isApproval
      ? await withTransaction(async (transaction) => {
          const casResult = await this.components.updateApprovalStatus(
            current.id,
            current.approvalStatus,
            nextStatus,
            actorUserId,
            transaction,
          );
          if (casResult.outcome === "updated") {
            await this.components.supersedeOtherApprovedVersion(
              current.recordId,
              current.id,
              actorUserId,
              transaction,
            );
          }
          return casResult;
        })
      : await this.components.updateApprovalStatus(
          current.id,
          current.approvalStatus,
          nextStatus,
          actorUserId,
        );

    if (result.outcome === "not_found") {
      throw new NotFoundException(`Component not found: ${recordId}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Component ${recordId} approval status changed concurrently ` +
          `(expected ${current.approvalStatus}, now ${result.entity.approvalStatus}) — reload and retry`,
      );
    }

    // A failed audit write here is caught and only console.error'd, not retried or alerted on —
    // the byte-identical, already-accepted pattern
    // DesignTokensService.changeApprovalStatus()/WebsiteStrategyRecordsService.changeApprovalStatus()/
    // ClaimsService.changeApprovalStatus()/PersonasService.changeApprovalStatus()/
    // ServicesService.changeApprovalStatus() all have.
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        entityType: "component",
        entityId: current.id,
        action: `status:${current.approvalStatus}->${nextStatus}`,
        beforeState: { approvalStatus: current.approvalStatus },
        afterState: { approvalStatus: nextStatus },
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Component ${recordId} approval status transition ` +
          `${current.approvalStatus}->${nextStatus} committed, but recording its audit event failed:`,
        error,
      );
    }

    return result.entity;
  }
}
