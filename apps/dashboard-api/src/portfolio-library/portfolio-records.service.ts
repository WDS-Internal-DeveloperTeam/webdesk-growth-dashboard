import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  PortfolioApprovalStatus,
  PortfolioRecordEntity,
  PortfolioRecordListFilter,
  PortfolioRecordRepository,
} from "@webdesk/database";
import { isSequelizeUniqueConstraintError } from "@webdesk/validation";
import {
  PORTFOLIO_LIBRARY_MODULE_KEY,
  PORTFOLIO_RECORD_REPOSITORY,
} from "./portfolio-library.constants.js";
import type {
  CreatePortfolioRecordDto,
  UpdatePortfolioRecordDto,
} from "./portfolio-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
import type { RecordAuditEventInput } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { ClaimsService } from "../proof-and-claims-library/claims.service.js";

/** A malformed (non-UUID) id can never resolve to a real claim — filtered out before querying
 *  rather than sent to Postgres, whose `uuid` column type would otherwise reject it with a raw
 *  driver error the global exception filter turns into an opaque 500 instead of a clean 400 —
 *  mirrors `CaseStudiesService.assertClaimIdsExist()`'s/`PersonasService.assertServiceIdsExist()`'s
 *  own identical guard. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The real, seeded RBAC action (`06_Roles_and_Permissions.md`) required for a given
 *  `approvalStatus` transition — identical vocabulary to Persona/Service/Content Template
 *  Library's own. */
type PortfolioApprovalAction = "submit" | "review" | "approve";

/**
 * Reused verbatim (byte-for-byte, D6) from `ContentTemplatesService`'s own (already code-reviewed)
 * `TRANSITIONS` table — a single source of truth for both "is this transition legal" (a key's
 * presence) and "what RBAC action does it require" (the value). `submitted`/`revision_requested`/
 * `rejected -> draft` all require `submit` (the submitter/editor drives the revise-and-resubmit
 * loop, not the approver). `archived`/`superseded` are both terminal — no code path resurrects a
 * record from either.
 */
const TRANSITIONS: Readonly<
  Record<
    PortfolioApprovalStatus,
    Readonly<Partial<Record<PortfolioApprovalStatus, PortfolioApprovalAction>>>
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
  approved: { superseded: "approve", archived: "approve" },
  rejected: { draft: "submit", archived: "approve" },
  superseded: {},
  archived: {},
};

@Injectable()
export class PortfolioRecordsService {
  constructor(
    @Inject(PORTFOLIO_RECORD_REPOSITORY)
    private readonly portfolioRecords: PortfolioRecordRepository,
    private readonly claims: ClaimsService,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  /** Validates `relatedProofIds` against the real, already-existing `proof_claims` table, via
   *  `ClaimsService.existingClaimIds()` — a narrow, read-only delegating method, not a raw
   *  repository token directly (matching Case Study Studio's/Persona Library's own established
   *  precedent, and the fix Persona Library's own security review already required once for a
   *  raw-repository-export exposure). */
  /** "Log, don't throw" — the mutation this audit event describes has already committed by the
   *  time this runs, so a failure here must never surface as a failed request. Shared by
   *  `changeApprovalStatus()`/`publish()`/`unpublish()` so the three near-identical try/catch
   *  blocks stay in exactly one place. */
  private async recordAuditSafely(
    input: RecordAuditEventInput,
    failureContext: string,
  ): Promise<void> {
    try {
      await this.auditService.record(input);
    } catch (error) {
      console.error(`${failureContext}, but recording its audit event failed:`, error);
    }
  }

  private async assertProofIdsExist(ids: readonly string[] | null | undefined): Promise<void> {
    if (!ids || ids.length === 0) {
      return;
    }
    const wellFormedIds = ids.filter((id) => UUID_PATTERN.test(id));
    const foundIds =
      wellFormedIds.length > 0
        ? await this.claims.existingClaimIds(wellFormedIds)
        : new Set<string>();
    const missing = ids.filter((id) => !foundIds.has(id));
    if (missing.length > 0) {
      throw new BadRequestException(`relatedProofIds not found: ${missing.join(", ")}`);
    }
  }

  async create(
    input: CreatePortfolioRecordDto,
    actorUserId: string,
  ): Promise<PortfolioRecordEntity> {
    // Independent checks (different tables, neither consumes the other's result) — run
    // concurrently, matching CaseStudiesService.create()'s/ServicesService.create()'s own
    // established pattern.
    const [existing] = await Promise.all([
      this.portfolioRecords.findByPublicId(input.publicId),
      this.assertProofIdsExist(input.relatedProofIds),
    ]);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: PortfolioRecordEntity;
    try {
      created = await this.portfolioRecords.create({ ...input, createdBy: actorUserId });
    } catch (error) {
      // The publicId uniqueness check above is TOCTOU (two concurrent creates with the same
      // publicId can both pass it before either INSERT commits) — the real unique index catches
      // the race loser, but without this catch it would otherwise surface as a raw 500 instead of
      // the same clean 400 the check above already gives the non-racing caller. Uses the shared
      // `@webdesk/validation` helper (mirrors CaseStudiesService.create()'s own already-fixed
      // pattern), not a hand-rolled `error.name === "SequelizeUniqueConstraintError"` check.
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(`publicId already in use: ${input.publicId}`);
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "portfolio_record",
      entityId: created.id,
      action: "create",
      afterState: { projectOrClientName: created.projectOrClientName },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async findById(id: string): Promise<PortfolioRecordEntity> {
    const record = await this.portfolioRecords.findById(id);
    if (!record) {
      throw new NotFoundException(`Portfolio record not found: ${id}`);
    }
    return record;
  }

  async list(filter: PortfolioRecordListFilter): Promise<readonly PortfolioRecordEntity[]> {
    return this.portfolioRecords.list(filter);
  }

  /** Content update — `approvalStatus`/`isPublished`/`publishedAt` are deliberately never accepted
   *  here (D5/D6); only `changeApprovalStatus()`/`publish()`/`unpublish()` may change those.
   *  Rejects editing an `archived`/`superseded` record (both terminal, D6 — no code path
   *  resurrects a record from either), mirroring `ContentTemplatesService.update()`'s own
   *  identical guard. */
  async update(
    id: string,
    patch: UpdatePortfolioRecordDto,
    actorUserId: string,
  ): Promise<PortfolioRecordEntity> {
    // Independent reads (the terminal-state check needs `current`; the relationship-existence
    // check needs nothing from it) — run concurrently, mirroring CaseStudiesService.update()'s own
    // established pattern.
    const [current] = await Promise.all([
      this.findById(id),
      this.assertProofIdsExist(patch.relatedProofIds),
    ]);

    if (current.approvalStatus === "archived" || current.approvalStatus === "superseded") {
      throw new BadRequestException(
        `Portfolio record ${id} is ${current.approvalStatus} and can no longer be edited`,
      );
    }

    // current.approvalStatus is passed as a CAS guard — the terminal-state check above reads
    // approvalStatus into application memory, but without this the actual write would still be
    // unconditional, letting a concurrent changeApprovalStatus() transition land between the read
    // and this write and silently succeed against what is now an archived/superseded row (the same
    // TOCTOU race Website Strategy Center's/Content Template Library's own updateInPlace()/
    // expectedApprovalStatus already closed once for the identical bug class).
    const updated = await this.portfolioRecords.update(
      id,
      { ...patch, updatedBy: actorUserId },
      current.approvalStatus,
    );
    if (!updated) {
      // 0 affected rows means either the row is genuinely gone (no hard-delete exists for this
      // module today, but this still guards a hypothetical future one, matching every sibling
      // module's own identical belt-and-suspenders check) or — the real case the CAS guard above
      // exists for — its approvalStatus changed concurrently since the read. Distinguish the two
      // with a fresh read rather than assuming either, mirroring
      // ContentTemplatesService.update()'s own disambiguation.
      const stillExists = await this.portfolioRecords.findById(id);
      if (!stillExists) {
        throw new NotFoundException(`Portfolio record not found: ${id}`);
      }
      throw new ConflictException(
        `Portfolio record ${id} approval status changed concurrently while editing — reload and retry`,
      );
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "portfolio_record",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  async changeApprovalStatus(
    id: string,
    nextStatus: PortfolioApprovalStatus,
    actorUserId: string,
  ): Promise<PortfolioRecordEntity> {
    const record = await this.findById(id);
    if (record.approvalStatus === nextStatus) {
      return record; // no-op, not an error — re-requesting the current status is harmless
    }

    const requiredAction = TRANSITIONS[record.approvalStatus][nextStatus];
    if (!requiredAction) {
      throw new BadRequestException(
        `Invalid portfolio record approval status transition: ${record.approvalStatus} -> ${nextStatus}`,
      );
    }
    await this.authorizationService.assertAllowed(
      actorUserId,
      PORTFOLIO_LIBRARY_MODULE_KEY,
      requiredAction,
    );

    const result = await this.portfolioRecords.updateApprovalStatus(
      id,
      record.approvalStatus,
      nextStatus,
      actorUserId,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Portfolio record not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Portfolio record ${id} approval status changed concurrently ` +
          `(expected ${record.approvalStatus}, now ${result.entity.approvalStatus}) — reload and retry`,
      );
    }

    const isApproval = nextStatus === "approved";
    await this.recordAuditSafely(
      {
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        entityType: "portfolio_record",
        entityId: id,
        action: `status:${record.approvalStatus}->${nextStatus}`,
        beforeState: { approvalStatus: record.approvalStatus },
        afterState: { approvalStatus: nextStatus },
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      },
      `Portfolio record ${id} approval status transition ${record.approvalStatus}->${nextStatus} committed`,
    );

    return result.entity;
  }

  /**
   * Publish an `approved` portfolio record (D5). Rejects with a clean 400 BEFORE attempting the
   * CAS write if the record isn't currently `approved` — the only status/publish interaction this
   * module enforces. A concurrent double-publish (or a repeat call once already published)
   * surfaces as a clean 409 via the atomic compare-and-swap, never a silent no-op success —
   * deliberately asymmetric with `changeApprovalStatus()`'s own same-status-is-a-no-op short
   * circuit, mirroring `ContentTemplatesService.publish()`'s own reasoning exactly.
   *
   * `record.approvalStatus` (`"approved"`, the value the check above just confirmed) is also
   * passed as a CAS guard to `updatePublishState()` — without it, a concurrent
   * `changeApprovalStatus()` transition (e.g. `approved -> archived`) landing between the read and
   * this write could still let the publish succeed, since `isPublished` alone was still `false`
   * (the same TOCTOU race Content Template Library's own `publish()` already closed).
   */
  async publish(id: string, actorUserId: string): Promise<PortfolioRecordEntity> {
    // Deliberately sequential, not Promise.all — the approval-status check must run BEFORE the
    // RBAC check so a non-approved record fails with the more specific 400 without ever needing
    // "publish" permission, and so the RBAC check is never even attempted (and never observably
    // called) on a record that can't be published regardless of the actor's grants. Parallelizing
    // these would make which error the caller sees nondeterministic on a record that's both
    // non-approved and being published by an unauthorized actor.
    const record = await this.findById(id);
    if (record.approvalStatus !== "approved") {
      throw new BadRequestException(
        `Portfolio record ${id} cannot be published while its approval status is ` +
          `'${record.approvalStatus}' — only an approved record may be published.`,
      );
    }
    await this.authorizationService.assertAllowed(
      actorUserId,
      PORTFOLIO_LIBRARY_MODULE_KEY,
      "publish",
    );

    const NOT_YET_PUBLISHED = false;
    const NOW_PUBLISHED = true;
    const result = await this.portfolioRecords.updatePublishState(
      id,
      NOT_YET_PUBLISHED,
      NOW_PUBLISHED,
      actorUserId,
      record.approvalStatus,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Portfolio record not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Portfolio record ${id} was published concurrently, is already published, or its ` +
          `approval status changed concurrently — reload and retry.`,
      );
    }

    await this.recordAuditSafely(
      {
        eventType: "publish",
        actorUserId,
        actorType: "human",
        entityType: "portfolio_record",
        entityId: id,
        action: "publish",
        afterState: { isPublished: true },
        retentionCategory: "audit-7y",
      },
      `Portfolio record ${id} publish committed`,
    );

    return result.entity;
  }

  /**
   * Unpublish a portfolio record — always allowed regardless of current `approvalStatus` (D5): an
   * operator must always be able to pull a published record down, even one that has since moved to
   * `superseded`/`archived` (no automatic unpublish on a later status transition, matching Content
   * Template Library's own D3). A concurrent double-unpublish (or a repeat call once already
   * unpublished) surfaces as a clean 409 via the atomic compare-and-swap. `publishedAt` is never
   * touched here — it records only the first publish time, preserved as permanent history (D5).
   */
  async unpublish(id: string, actorUserId: string): Promise<PortfolioRecordEntity> {
    await this.authorizationService.assertAllowed(
      actorUserId,
      PORTFOLIO_LIBRARY_MODULE_KEY,
      "unpublish",
    );

    const CURRENTLY_PUBLISHED = true;
    const NOW_UNPUBLISHED = false;
    const result = await this.portfolioRecords.updatePublishState(
      id,
      CURRENTLY_PUBLISHED,
      NOW_UNPUBLISHED,
      actorUserId,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Portfolio record not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Portfolio record ${id} was unpublished concurrently, or is already unpublished — reload and retry.`,
      );
    }

    await this.recordAuditSafely(
      {
        eventType: "unpublish",
        actorUserId,
        actorType: "human",
        entityType: "portfolio_record",
        entityId: id,
        action: "unpublish",
        afterState: { isPublished: false },
        retentionCategory: "audit-7y",
      },
      `Portfolio record ${id} unpublish committed`,
    );

    return result.entity;
  }
}
