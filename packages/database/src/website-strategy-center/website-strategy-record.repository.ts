import { randomUUID } from "node:crypto";
import { Op, type Transaction } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getWebsiteStrategyCenterModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { WebsiteStrategyApprovalStatus, WebsiteStrategyRecordEntity } from "./entities.js";
import type { WebsiteStrategyRecordType } from "./entities.js";

export interface WebsiteStrategyRecordListFilter {
  readonly recordType?: WebsiteStrategyRecordType;
  readonly approvalStatus?: WebsiteStrategyApprovalStatus;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateWebsiteStrategyApprovalStatusResult =
  | { readonly outcome: "updated"; readonly entity: WebsiteStrategyRecordEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: WebsiteStrategyRecordEntity };

// Mirrors ProofClaimRepository's/PersonaRepository's/ServiceRepository's own
// DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/**
 * No `projectId` scoping anywhere here — this module's records are organization-wide, matching
 * Service Library/Business Knowledge Center/Persona Library/Proof and Claims Library (task
 * package D9).
 *
 * Unlike every sibling repository, this one implements REAL version history (task package
 * D2/D3): `create()` starts a brand-new logical record (a fresh `recordId`, `versionNumber: 1`).
 * Editing an already-`approved` current version does NOT call `create()` again — it calls
 * `updateInPlace()` (to flip the old row's `isCurrent` to `false`) and `createNewVersion()` (to
 * insert the new draft version row) together, inside one caller-supplied transaction — mirrors
 * `ProjectService.setActivePhase()`'s own placement: the SERVICE layer (`WebsiteStrategyRecordsService`)
 * opens `withTransaction()` and threads the `Transaction` handle through multiple separate
 * repository calls, not a single repository method that opens its own transaction internally.
 */
export class WebsiteStrategyRecordRepository {
  private readonly model = getWebsiteStrategyCenterModels().WebsiteStrategyRecord;

  /** Starts a brand-new logical record: a fresh `recordId`, `versionNumber: 1`, `isCurrent: true`,
   *  `approvalStatus: "draft"`. `recordId` is generated here (not left to a database default)
   *  since `createNewVersion()` later needs to reuse the exact same value across every version
   *  row of the same record. */
  async create(input: {
    publicId: string;
    recordType: WebsiteStrategyRecordType;
    title: string;
    content?: string | null;
    notes?: string | null;
    createdBy?: string | null;
  }): Promise<WebsiteStrategyRecordEntity> {
    const instance = await this.model.create({
      recordId: randomUUID(),
      publicId: input.publicId,
      recordType: input.recordType,
      versionNumber: 1,
      isCurrent: true,
      title: input.title,
      content: input.content ?? null,
      notes: input.notes ?? null,
      approvalStatus: "draft",
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<WebsiteStrategyRecordEntity>(instance);
  }

  /** Inserts a NEW version row of an EXISTING logical record — `recordId` is the caller's
   *  (copied forward from the record's own current version, never generated fresh here), and
   *  `recordType`/`publicId` are likewise copied forward, both immutable across a record's own
   *  version chain (task package D3). Always `isCurrent: true`/`approvalStatus: "draft"` — the
   *  caller (`WebsiteStrategyRecordsService.update()`) is responsible for flipping the OLD current
   *  row's `isCurrent` to `false` in the SAME transaction (via `updateInPlace()`), so exactly one
   *  row per `recordId` is ever `isCurrent = true` at a time. */
  async createNewVersion(
    input: {
      recordId: string;
      publicId: string;
      recordType: WebsiteStrategyRecordType;
      versionNumber: number;
      title: string;
      content: string | null;
      notes: string | null;
      createdBy?: string | null;
    },
    transaction?: Transaction,
  ): Promise<WebsiteStrategyRecordEntity> {
    const instance = await this.model.create(
      {
        recordId: input.recordId,
        publicId: input.publicId,
        recordType: input.recordType,
        versionNumber: input.versionNumber,
        isCurrent: true,
        title: input.title,
        content: input.content,
        notes: input.notes,
        approvalStatus: "draft",
        createdBy: input.createdBy ?? null,
        updatedBy: input.createdBy ?? null,
      },
      { transaction },
    );
    return toEntityWithIsoDates<WebsiteStrategyRecordEntity>(instance);
  }

  async findCurrentByRecordId(recordId: string): Promise<WebsiteStrategyRecordEntity | null> {
    const instance = await this.model.findOne({ where: { recordId, isCurrent: true } });
    return instance ? toEntityWithIsoDates<WebsiteStrategyRecordEntity>(instance) : null;
  }

  async findCurrentByPublicId(publicId: string): Promise<WebsiteStrategyRecordEntity | null> {
    const instance = await this.model.findOne({ where: { publicId, isCurrent: true } });
    return instance ? toEntityWithIsoDates<WebsiteStrategyRecordEntity>(instance) : null;
  }

  /** Every row (every version) of one logical record, oldest first. An empty array means the
   *  `recordId` has never existed — the service layer (`listVersions()`) turns that into a clean
   *  404, distinct from a `recordId` that exists but happens to have no rows matching some other
   *  filter (there is no such filter here — every row for a known `recordId` is always returned). */
  async listVersions(recordId: string): Promise<readonly WebsiteStrategyRecordEntity[]> {
    const rows = await this.model.findAll({
      where: { recordId },
      order: [["versionNumber", "ASC"]],
    });
    return rows.map((row) => toEntityWithIsoDates<WebsiteStrategyRecordEntity>(row));
  }

  /** Lists CURRENT versions only (`isCurrent = true`), matching every sibling `list()`'s own
   *  "list only shows the live/current state" convention. */
  async list(
    filter: WebsiteStrategyRecordListFilter = {},
  ): Promise<readonly WebsiteStrategyRecordEntity[]> {
    const where: Record<string, unknown> = { isCurrent: true };
    if (filter.recordType) {
      where.recordType = filter.recordType;
    }
    if (filter.approvalStatus) {
      where.approvalStatus = filter.approvalStatus;
    }
    if (filter.search) {
      where.title = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two
      // separate paginated queries, matching ProofClaimRepository's own precedent.
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<WebsiteStrategyRecordEntity>(row));
  }

  /**
   * A plain, generic `UPDATE ... WHERE id = ... RETURNING`, scoped to one physical row (a single
   * version). Used two ways by the service layer: (1) content edits on a non-approved current
   * row (`title`/`content`/`notes`/`updatedBy`), and (2) flipping the OLD current row's
   * `isCurrent` to `false` when a new version is created (`isCurrent`/`updatedBy`), inside the
   * same transaction as `createNewVersion()`. `approvalStatus` is deliberately never accepted
   * here — only `updateApprovalStatus()` may change it, same discipline as
   * `ProofClaimRepository.update()`/`PersonaRepository.update()`.
   */
  async updateInPlace(
    id: string,
    patch: Partial<{
      title: string;
      content: string | null;
      notes: string | null;
      isCurrent: boolean;
      updatedBy: string | null;
    }>,
    transaction?: Transaction,
    expectedApprovalStatus?: WebsiteStrategyApprovalStatus,
  ): Promise<WebsiteStrategyRecordEntity | null> {
    const where: Record<string, unknown> = { id };
    if (expectedApprovalStatus) {
      // A CAS guard, mirroring updateApprovalStatus()'s own conditional-UPDATE pattern — the
      // caller (WebsiteStrategyRecordsService.update()'s non-approved edit branch) passes the
      // approvalStatus it observed at read time, so a concurrent approval landing between that
      // read and this write makes this a no-op (0 affected rows) instead of silently mutating a
      // row that just became approved.
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
    return toEntityWithIsoDates<WebsiteStrategyRecordEntity>(affectedRows[0]);
  }

  /** Atomic compare-and-swap on `(id, approvalStatus)` — mirrors `ProofClaimRepository.updateStatus()`'s/
   *  `PersonaRepository.updateStatus()`'s/`ServiceRepository.updateStatus()`'s own conditional-`UPDATE`
   *  pattern exactly, which itself mirrors `IdempotencyKeyRepository.reserve()`. Prevents two
   *  concurrent approvers from both reading the same `expectedCurrentStatus` and both "succeeding".
   *  Accepts an optional `transaction` so a successful `-> approved` transition can compose with
   *  `supersedeOtherApprovedVersion()` inside one atomic unit (task package D4). */
  async updateApprovalStatus(
    id: string,
    expectedCurrentStatus: WebsiteStrategyApprovalStatus,
    nextStatus: WebsiteStrategyApprovalStatus,
    updatedBy: string | null,
    transaction?: Transaction,
  ): Promise<UpdateWebsiteStrategyApprovalStatusResult> {
    const [affectedCount, affectedRows] = await this.model.update(
      { approvalStatus: nextStatus, updatedBy },
      { where: { id, approvalStatus: expectedCurrentStatus }, returning: true, transaction },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<WebsiteStrategyRecordEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id }, transaction });
    if (!current) {
      return { outcome: "not_found" };
    }
    return {
      outcome: "conflict",
      entity: toEntityWithIsoDates<WebsiteStrategyRecordEntity>(current),
    };
  }

  /**
   * Task package D4 — "supersede" is not a distinct user action; it's an automatic consequence of
   * approving a new version. Flips whichever OTHER row of the same `recordId` currently holds
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
