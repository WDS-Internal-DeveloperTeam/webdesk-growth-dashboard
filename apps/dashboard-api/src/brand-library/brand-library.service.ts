import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  BrandLibraryApprovalStatus,
  BrandLibraryRecordEntity,
  BrandLibraryRecordListFilter,
  BrandLibraryRecordRepository,
} from "@webdesk/database";
import {
  isSequelizeUniqueConstraintError,
  sanitizeNullableRichText,
  sanitizeNullableRichTextIfChanged,
} from "@webdesk/validation";
import {
  BRAND_LIBRARY_MODULE_KEY,
  BRAND_LIBRARY_RECORD_REPOSITORY,
} from "./brand-library.constants.js";
import type {
  CreateBrandLibraryRecordDto,
  UpdateBrandLibraryRecordDto,
} from "./brand-library.dto.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuditService } from "../audit/audit.service.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- real (value) import: NestJS constructor injection needs the class reference at runtime.
import { AuthorizationService } from "../authz/authorization.service.js";

/** The real, seeded RBAC action (`06_Roles_and_Permissions.md`) required for a given
 *  `approvalStatus` transition — identical vocabulary to Content Template Library's/Persona
 *  Library's/Service Library's own. */
type BrandLibraryApprovalAction = "submit" | "review" | "approve";

/**
 * Reused verbatim (byte-for-byte, D4) from `ContentTemplatesService`'s own (already code-reviewed)
 * `TRANSITIONS` table — a single source of truth for both "is this transition legal" (a key's
 * presence) and "what RBAC action does it require" (the value). `submitted`/
 * `revision_requested`/`rejected -> draft` all require `submit` (the submitter/editor drives the
 * revise-and-resubmit loop, not the approver). `archived`/`superseded` are both terminal — no code
 * path resurrects a record from either.
 */
const TRANSITIONS: Readonly<
  Record<
    BrandLibraryApprovalStatus,
    Readonly<Partial<Record<BrandLibraryApprovalStatus, BrandLibraryApprovalAction>>>
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
export class BrandLibraryService {
  constructor(
    @Inject(BRAND_LIBRARY_RECORD_REPOSITORY)
    private readonly records: BrandLibraryRecordRepository,
    private readonly authorizationService: AuthorizationService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    input: CreateBrandLibraryRecordDto,
    actorUserId: string,
  ): Promise<BrandLibraryRecordEntity> {
    const existing = await this.records.findByPublicId(input.publicId);
    if (existing) {
      throw new BadRequestException(`publicId already in use: ${input.publicId}`);
    }

    let created: BrandLibraryRecordEntity;
    try {
      created = await this.records.create({
        ...input,
        description: sanitizeNullableRichText(input.description),
        usageNotes: sanitizeNullableRichText(input.usageNotes),
        createdBy: actorUserId,
      });
    } catch (error) {
      // The publicId uniqueness check above is TOCTOU (two concurrent creates with the same
      // publicId can both pass it before either INSERT commits) — the real unique index catches
      // the race loser, but without this catch it would otherwise surface as a raw 500 instead of
      // the same clean 400 the check above already gives the non-racing caller. Uses the shared
      // `isSequelizeUniqueConstraintError()` helper (`@webdesk/validation`, already used by
      // Page Inventory/Keyword & Entity Library/Internal Linking Library), not a hand-rolled
      // `error.name === "SequelizeUniqueConstraintError"` check (code-review finding — that manual
      // form predates the helper's extraction and this module had no reason to reintroduce it).
      if (isSequelizeUniqueConstraintError(error)) {
        throw new BadRequestException(`publicId already in use: ${input.publicId}`);
      }
      throw error;
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "brand_library_record",
      entityId: created.id,
      action: "create",
      afterState: { recordType: created.recordType, title: created.title },
      retentionCategory: "audit-7y",
    });

    return created;
  }

  async findById(id: string): Promise<BrandLibraryRecordEntity> {
    const record = await this.records.findById(id);
    if (!record) {
      throw new NotFoundException(`Brand library record not found: ${id}`);
    }
    return record;
  }

  async list(filter: BrandLibraryRecordListFilter): Promise<readonly BrandLibraryRecordEntity[]> {
    return this.records.list(filter);
  }

  async update(
    id: string,
    patch: UpdateBrandLibraryRecordDto,
    actorUserId: string,
  ): Promise<BrandLibraryRecordEntity> {
    const current = await this.findById(id);

    // archived/superseded are both terminal (TRANSITIONS's own entries for both are `{}` — no
    // code path resurrects a record from either) — content on a terminal row must never change,
    // mirroring ContentTemplatesService.update()'s own identical guard.
    if (current.approvalStatus === "archived" || current.approvalStatus === "superseded") {
      throw new BadRequestException(
        `Brand library record ${id} is ${current.approvalStatus} and can no longer be edited`,
      );
    }

    // current.approvalStatus is passed as a CAS guard — the terminal-state check above reads
    // approvalStatus into application memory, but without this the actual write was still
    // unconditional — a concurrent changeApprovalStatus() transition landing between the read and
    // this write could let this edit silently succeed against what is now an archived/superseded
    // row, mirroring ContentTemplatesService.update()'s own identical fix.
    const updated = await this.records.update(
      id,
      {
        ...patch,
        description: sanitizeNullableRichTextIfChanged(patch.description, current.description),
        usageNotes: sanitizeNullableRichTextIfChanged(patch.usageNotes, current.usageNotes),
        updatedBy: actorUserId,
      },
      current.approvalStatus,
    );
    if (!updated) {
      // 0 affected rows means either the row is genuinely gone (no hard-delete exists for this
      // module today, but this still guards a hypothetical future one, matching every sibling
      // module's own identical belt-and-suspenders check) or — the real case the CAS guard above
      // exists for — its approvalStatus changed concurrently since the read. Distinguish the two
      // with a fresh read rather than assuming either, mirroring
      // ContentTemplatesService.update()'s own disambiguation.
      const stillExists = await this.records.findById(id);
      if (!stillExists) {
        throw new NotFoundException(`Brand library record not found: ${id}`);
      }
      throw new ConflictException(
        `Brand library record ${id} approval status changed concurrently while editing — reload and retry`,
      );
    }

    await this.auditService.record({
      eventType: "data_change",
      actorUserId,
      actorType: "human",
      entityType: "brand_library_record",
      entityId: id,
      action: "update",
      afterState: { ...patch },
      retentionCategory: "audit-7y",
    });

    return updated;
  }

  async changeApprovalStatus(
    id: string,
    nextStatus: BrandLibraryApprovalStatus,
    actorUserId: string,
  ): Promise<BrandLibraryRecordEntity> {
    const record = await this.findById(id);
    if (record.approvalStatus === nextStatus) {
      return record; // no-op, not an error — re-requesting the current status is harmless
    }

    const requiredAction = TRANSITIONS[record.approvalStatus][nextStatus];
    if (!requiredAction) {
      throw new BadRequestException(
        `Invalid brand library record approval status transition: ${record.approvalStatus} -> ${nextStatus}`,
      );
    }
    await this.authorizationService.assertAllowed(
      actorUserId,
      BRAND_LIBRARY_MODULE_KEY,
      requiredAction,
    );

    const result = await this.records.updateApprovalStatus(
      id,
      record.approvalStatus,
      nextStatus,
      actorUserId,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Brand library record not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Brand library record ${id} approval status changed concurrently ` +
          `(expected ${record.approvalStatus}, now ${result.entity.approvalStatus}) — reload and retry`,
      );
    }

    const isApproval = nextStatus === "approved";
    try {
      await this.auditService.record({
        eventType: isApproval ? "approval" : "data_change",
        actorUserId,
        actorType: "human",
        entityType: "brand_library_record",
        entityId: id,
        action: `status:${record.approvalStatus}->${nextStatus}`,
        beforeState: { approvalStatus: record.approvalStatus },
        afterState: { approvalStatus: nextStatus },
        retentionCategory: isApproval ? "approval-audit-7y" : "audit-7y",
      });
    } catch (error) {
      console.error(
        `Brand library record ${id} approval status transition ${record.approvalStatus}->${nextStatus} ` +
          "committed, but recording its audit event failed:",
        error,
      );
    }

    return result.entity;
  }

  /**
   * Publish an `approved` brand library record (D5). Rejects with a clean 400 BEFORE attempting
   * the CAS write if the record isn't currently `approved` — the only status/publish interaction
   * this module enforces. A concurrent double-publish (or a repeat call once already published)
   * surfaces as a clean 409 via the atomic compare-and-swap, never a silent no-op success —
   * deliberately asymmetric with `changeApprovalStatus()`'s own same-status-is-a-no-op short
   * circuit, mirroring `ContentTemplatesService.publish()`'s own identical reasoning.
   *
   * `record.approvalStatus` (`"approved"`, the value the check above just confirmed) is also
   * passed as a CAS guard to `updatePublishState()` — the check above only reads `approvalStatus`
   * into application memory; without also guarding the write on it, a concurrent
   * `changeApprovalStatus()` transition (e.g. `approved -> archived`) landing between the read and
   * this write could still let the publish succeed, since `isPublished` alone was still `false`.
   */
  async publish(id: string, actorUserId: string): Promise<BrandLibraryRecordEntity> {
    const record = await this.findById(id);
    if (record.approvalStatus !== "approved") {
      throw new BadRequestException(
        `Brand library record ${id} cannot be published while its approval status is ` +
          `'${record.approvalStatus}' — only an approved record may be published.`,
      );
    }
    await this.authorizationService.assertAllowed(actorUserId, BRAND_LIBRARY_MODULE_KEY, "publish");

    const NOT_YET_PUBLISHED = false;
    const NOW_PUBLISHED = true;
    const result = await this.records.updatePublishState(
      id,
      NOT_YET_PUBLISHED,
      NOW_PUBLISHED,
      actorUserId,
      record.approvalStatus,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Brand library record not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Brand library record ${id} was published concurrently, is already published, or its ` +
          `approval status changed concurrently — reload and retry.`,
      );
    }

    try {
      await this.auditService.record({
        eventType: "publish",
        actorUserId,
        actorType: "human",
        entityType: "brand_library_record",
        entityId: id,
        action: "publish",
        afterState: { isPublished: true },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(
        `Brand library record ${id} publish committed, but recording its audit event failed:`,
        error,
      );
    }

    return result.entity;
  }

  /**
   * Unpublish a brand library record — always allowed regardless of current `approvalStatus`
   * (D5): an operator must always be able to pull a published record down, even one that has
   * since moved to `superseded`/`archived`. A concurrent double-unpublish (or a repeat call once
   * already unpublished) surfaces as a clean 409 via the atomic compare-and-swap, the same
   * asymmetric-with-`changeApprovalStatus()` reasoning as `publish()`. `publishedAt` is never
   * touched here — it records only the first publish time, preserved as permanent history (D5).
   */
  async unpublish(id: string, actorUserId: string): Promise<BrandLibraryRecordEntity> {
    await this.authorizationService.assertAllowed(
      actorUserId,
      BRAND_LIBRARY_MODULE_KEY,
      "unpublish",
    );

    const CURRENTLY_PUBLISHED = true;
    const NOW_UNPUBLISHED = false;
    const result = await this.records.updatePublishState(
      id,
      CURRENTLY_PUBLISHED,
      NOW_UNPUBLISHED,
      actorUserId,
    );
    if (result.outcome === "not_found") {
      throw new NotFoundException(`Brand library record not found: ${id}`);
    }
    if (result.outcome === "conflict") {
      throw new ConflictException(
        `Brand library record ${id} was unpublished concurrently, or is already unpublished — reload and retry.`,
      );
    }

    try {
      await this.auditService.record({
        eventType: "unpublish",
        actorUserId,
        actorType: "human",
        entityType: "brand_library_record",
        entityId: id,
        action: "unpublish",
        afterState: { isPublished: false },
        retentionCategory: "audit-7y",
      });
    } catch (error) {
      console.error(
        `Brand library record ${id} unpublish committed, but recording its audit event failed:`,
        error,
      );
    }

    return result.entity;
  }
}
