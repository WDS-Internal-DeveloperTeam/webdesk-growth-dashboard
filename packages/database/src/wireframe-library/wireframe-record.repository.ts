import { randomUUID } from "node:crypto";
import { Op, type Transaction } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getWireframeLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type {
  WireframeApprovalStatus,
  WireframeRecordEntity,
  WireframeViewport,
} from "./entities.js";

export interface WireframeRecordListFilter {
  readonly viewport?: WireframeViewport;
  readonly approvalStatus?: WireframeApprovalStatus;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateWireframeApprovalStatusResult =
  | { readonly outcome: "updated"; readonly entity: WireframeRecordEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: WireframeRecordEntity };

// Mirrors SectionPatternRecordRepository's/DesignTokenRepository's own DEFAULT_LIST_LIMIT/
// MAX_LIST_LIMIT clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

interface WireframeVersionRowInput {
  readonly publicId: string;
  readonly pageOrModule: string;
  readonly viewport: WireframeViewport;
  readonly fileReference: string | null;
  readonly annotations: string | null;
  readonly interactionNotes: string | null;
  readonly relatedTemplateId: string | null;
  readonly reviewerUserId: string | null;
  readonly createdBy: string | null;
}

/**
 * No `projectId` scoping anywhere here — this module's records are organization-wide, matching
 * every other library-shaped module (scope doc).
 *
 * File-for-file mirrors `SectionPatternRecordRepository` — implements REAL version history:
 * `create()` starts a brand-new logical record (a fresh `recordId`, `versionNumber: 1`). Editing an
 * already-`approved` current version does NOT call `create()` again — it calls `updateInPlace()`
 * (to flip the old row's `isCurrent` to `false`) and `createNewVersion()` (to insert the new draft
 * version row) together, inside one caller-supplied transaction — the SERVICE layer
 * (`WireframesService`) opens `withTransaction()` and threads the `Transaction` handle through
 * multiple separate repository calls, not a single repository method that opens its own
 * transaction internally.
 */
export class WireframeRecordRepository {
  private readonly model = getWireframeLibraryModels().WireframeRecord;

  /** Shared row-builder for both `create()` (a brand-new logical record) and `createNewVersion()`
   *  (a new version row of an existing one) — a single source of truth for the field list so a
   *  field added to one and not the other doesn't silently drop a caller-supplied value, mirroring
   *  `SectionPatternRecordRepository.buildVersionRow()`'s own fix. `recordId`/`versionNumber`/
   *  `isCurrent` are supplied per-call, not by this helper, since they differ by construction
   *  between the two callers. */
  private buildVersionRow(
    input: WireframeVersionRowInput,
    recordId: string,
    versionNumber: number,
  ): Record<string, unknown> {
    return {
      recordId,
      publicId: input.publicId,
      pageOrModule: input.pageOrModule,
      versionNumber,
      isCurrent: true,
      viewport: input.viewport,
      fileReference: input.fileReference,
      annotations: input.annotations,
      interactionNotes: input.interactionNotes,
      relatedTemplateId: input.relatedTemplateId,
      reviewerUserId: input.reviewerUserId,
      approvalStatus: "draft",
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    };
  }

  /** Starts a brand-new logical record: a fresh `recordId`, `versionNumber: 1`, `isCurrent: true`,
   *  `approvalStatus: "draft"`. `recordId` is generated here (not left to a database default)
   *  since `createNewVersion()` later needs to reuse the exact same value across every version row
   *  of the same record. */
  async create(
    input: Pick<WireframeVersionRowInput, "publicId" | "pageOrModule" | "viewport"> &
      Partial<
        Omit<WireframeVersionRowInput, "publicId" | "pageOrModule" | "viewport" | "createdBy">
      > & { createdBy?: string | null },
  ): Promise<WireframeRecordEntity> {
    const instance = await this.model.create(
      this.buildVersionRow(
        {
          publicId: input.publicId,
          pageOrModule: input.pageOrModule,
          viewport: input.viewport,
          fileReference: input.fileReference ?? null,
          annotations: input.annotations ?? null,
          interactionNotes: input.interactionNotes ?? null,
          relatedTemplateId: input.relatedTemplateId ?? null,
          reviewerUserId: input.reviewerUserId ?? null,
          createdBy: input.createdBy ?? null,
        },
        randomUUID(),
        1,
      ),
    );
    return toEntityWithIsoDates<WireframeRecordEntity>(instance);
  }

  /** Inserts a NEW version row of an EXISTING logical record — `recordId` is the caller's
   *  (copied forward from the record's own current version, never generated fresh here), and
   *  `pageOrModule`/`publicId` are likewise copied forward, both immutable across a record's own
   *  version chain. Always `isCurrent: true`/`approvalStatus: "draft"` — the caller
   *  (`WireframesService.update()`) is responsible for flipping the OLD current row's `isCurrent`
   *  to `false` in the SAME transaction (via `updateInPlace()`), so exactly one row per `recordId`
   *  is ever `isCurrent = true` at a time. */
  async createNewVersion(
    input: Omit<WireframeVersionRowInput, "createdBy"> & {
      readonly recordId: string;
      readonly versionNumber: number;
      readonly createdBy?: string | null;
    },
    transaction?: Transaction,
  ): Promise<WireframeRecordEntity> {
    const instance = await this.model.create(
      this.buildVersionRow(
        {
          publicId: input.publicId,
          pageOrModule: input.pageOrModule,
          viewport: input.viewport,
          fileReference: input.fileReference,
          annotations: input.annotations,
          interactionNotes: input.interactionNotes,
          relatedTemplateId: input.relatedTemplateId,
          reviewerUserId: input.reviewerUserId,
          createdBy: input.createdBy ?? null,
        },
        input.recordId,
        input.versionNumber,
      ),
      { transaction },
    );
    return toEntityWithIsoDates<WireframeRecordEntity>(instance);
  }

  async findCurrentByRecordId(recordId: string): Promise<WireframeRecordEntity | null> {
    const instance = await this.model.findOne({ where: { recordId, isCurrent: true } });
    return instance ? toEntityWithIsoDates<WireframeRecordEntity>(instance) : null;
  }

  async findCurrentByPublicId(publicId: string): Promise<WireframeRecordEntity | null> {
    const instance = await this.model.findOne({ where: { publicId, isCurrent: true } });
    return instance ? toEntityWithIsoDates<WireframeRecordEntity>(instance) : null;
  }

  /** Every row (every version) of one logical record, oldest first. An empty array means the
   *  `recordId` has never existed — the service layer (`listVersions()`) turns that into a clean
   *  404, distinct from a `recordId` that exists but happens to have no rows matching some other
   *  filter (there is no such filter here — every row for a known `recordId` is always returned). */
  async listVersions(recordId: string): Promise<readonly WireframeRecordEntity[]> {
    const rows = await this.model.findAll({
      where: { recordId },
      order: [["versionNumber", "ASC"]],
    });
    return rows.map((row) => toEntityWithIsoDates<WireframeRecordEntity>(row));
  }

  /** Lists CURRENT versions only (`isCurrent = true`), matching every sibling `list()`'s own
   *  "list only shows the live/current state" convention. */
  async list(filter: WireframeRecordListFilter = {}): Promise<readonly WireframeRecordEntity[]> {
    const where: Record<string, unknown> = { isCurrent: true };
    if (filter.viewport) {
      where.viewport = filter.viewport;
    }
    if (filter.approvalStatus) {
      where.approvalStatus = filter.approvalStatus;
    }
    if (filter.search) {
      where.pageOrModule = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two
      // separate paginated queries, matching SectionPatternRecordRepository's own precedent.
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<WireframeRecordEntity>(row));
  }

  /**
   * A plain, generic `UPDATE ... WHERE id = ... RETURNING`, scoped to one physical row (a single
   * version). Used two ways by the service layer: (1) content edits on a non-approved current row,
   * and (2) flipping the OLD current row's `isCurrent` to `false` when a new version is created
   * (`isCurrent`/`updatedBy`), inside the same transaction as `createNewVersion()`.
   * `approvalStatus` is deliberately never accepted here — only `updateApprovalStatus()` may
   * change it, same discipline as every sibling module's own `update()`.
   */
  async updateInPlace(
    id: string,
    patch: Partial<{
      viewport: WireframeViewport;
      fileReference: string | null;
      annotations: string | null;
      interactionNotes: string | null;
      relatedTemplateId: string | null;
      reviewerUserId: string | null;
      isCurrent: boolean;
      updatedBy: string | null;
    }>,
    transaction?: Transaction,
    expectedApprovalStatus?: WireframeApprovalStatus,
  ): Promise<WireframeRecordEntity | null> {
    const where: Record<string, unknown> = { id };
    if (expectedApprovalStatus) {
      // A CAS guard, mirroring updateApprovalStatus()'s own conditional-UPDATE pattern — the
      // caller (WireframesService.update()'s non-approved edit branch) passes the approvalStatus
      // it observed at read time, so a concurrent approval landing between that read and this
      // write makes this a no-op (0 affected rows) instead of silently mutating a row that just
      // became approved.
      where.approvalStatus = expectedApprovalStatus;
    }
    const [affectedCount, affectedRows] = await this.model.update(patch, {
      where,
      returning: true,
      transaction,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<WireframeRecordEntity>(affectedRows[0]);
  }

  /** Atomic compare-and-swap on `(id, approvalStatus)` — mirrors
   *  `SectionPatternRecordRepository.updateApprovalStatus()`'s own conditional-`UPDATE` pattern
   *  exactly, which itself mirrors `IdempotencyKeyRepository.reserve()`. Prevents two concurrent
   *  approvers from both reading the same `expectedCurrentStatus` and both "succeeding". Accepts an
   *  optional `transaction` so a successful `-> approved` transition can compose with
   *  `supersedeOtherApprovedVersion()` inside one atomic unit. */
  async updateApprovalStatus(
    id: string,
    expectedCurrentStatus: WireframeApprovalStatus,
    nextStatus: WireframeApprovalStatus,
    updatedBy: string | null,
    transaction?: Transaction,
  ): Promise<UpdateWireframeApprovalStatusResult> {
    const [affectedCount, affectedRows] = await this.model.update(
      { approvalStatus: nextStatus, updatedBy },
      { where: { id, approvalStatus: expectedCurrentStatus }, returning: true, transaction },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<WireframeRecordEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id }, transaction });
    if (!current) {
      return { outcome: "not_found" };
    }
    return {
      outcome: "conflict",
      entity: toEntityWithIsoDates<WireframeRecordEntity>(current),
    };
  }

  /**
   * "Supersede" is not a distinct user action; it's an automatic consequence of approving a new
   * version. Flips whichever OTHER row of the same `recordId` currently holds
   * `approvalStatus = "approved"` (there is at most one, by construction — this method is only
   * ever called immediately after `updateApprovalStatus()` itself just wrote `"approved"` onto
   * `excludingId`) to `"superseded"`. A safe no-op when no such row exists (a record's first-ever
   * approval). Always called inside the same transaction as the triggering `updateApprovalStatus()`
   * call, so both writes commit or roll back together.
   */
  async supersedeOtherApprovedVersion(
    recordId: string,
    excludingId: string,
    updatedBy: string | null,
    transaction?: Transaction,
  ): Promise<void> {
    await this.model.update(
      { approvalStatus: "superseded", updatedBy },
      {
        where: { recordId, approvalStatus: "approved", id: { [Op.ne]: excludingId } },
        transaction,
      },
    );
  }
}
