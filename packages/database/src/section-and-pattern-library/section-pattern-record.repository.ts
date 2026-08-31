import { randomUUID } from "node:crypto";
import { Op, type Transaction } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getSectionAndPatternLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type {
  SectionPatternApprovalStatus,
  SectionPatternRecordEntity,
  SectionPatternType,
} from "./entities.js";

export interface SectionPatternRecordListFilter {
  readonly patternType?: SectionPatternType;
  readonly approvalStatus?: SectionPatternApprovalStatus;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateSectionPatternApprovalStatusResult =
  | { readonly outcome: "updated"; readonly entity: SectionPatternRecordEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: SectionPatternRecordEntity };

// Mirrors DesignTokenRepository's/WebsiteStrategyRecordRepository's own DEFAULT_LIST_LIMIT/
// MAX_LIST_LIMIT clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/**
 * No `projectId` scoping anywhere here — this module's records are organization-wide, matching
 * every other library-shaped module (design decision, scope doc).
 *
 * File-for-file mirrors `DesignTokenRepository` — implements REAL version history: `create()`
 * starts a brand-new logical record (a fresh `recordId`, `versionNumber: 1`). Editing an
 * already-`approved` current version does NOT call `create()` again — it calls `updateInPlace()`
 * (to flip the old row's `isCurrent` to `false`) and `createNewVersion()` (to insert the new draft
 * version row) together, inside one caller-supplied transaction — the SERVICE layer
 * (`SectionPatternsService`) opens `withTransaction()` and threads the `Transaction` handle
 * through multiple separate repository calls, not a single repository method that opens its own
 * transaction internally.
 */
interface SectionPatternVersionRowInput {
  readonly publicId: string;
  readonly patternType: SectionPatternType;
  readonly name: string;
  readonly description: string | null;
  readonly designReference: string | null;
  readonly htmlStructure: string | null;
  readonly phpPath: string | null;
  readonly scssReference: string | null;
  readonly jsDependencies: readonly string[];
  readonly responsiveBehavior: string | null;
  readonly accessibilityNotes: string | null;
  readonly browserSupport: string | null;
  readonly tokenReferences: readonly string[];
  readonly relatedComponentIds: readonly string[];
  readonly createdBy: string | null;
}

export class SectionPatternRecordRepository {
  private readonly model = getSectionAndPatternLibraryModels().SectionPatternRecord;

  /** Shared row-builder for both `create()` (a brand-new logical record) and `createNewVersion()`
   *  (a new version row of an existing one) — the two previously hand-duplicated the identical
   *  field list, a real risk that a field added to one and not the other silently drops a
   *  caller-supplied value (allowNull columns with no defaultValue store NULL, no error) on
   *  whichever path was missed, mirroring the fix already applied once to `DesignTokenRepository`.
   *  `recordId`/`versionNumber`/`isCurrent` are supplied per-call, not by this helper, since they
   *  differ by construction between the two callers. */
  private buildVersionRow(
    input: SectionPatternVersionRowInput,
    recordId: string,
    versionNumber: number,
  ): Record<string, unknown> {
    return {
      recordId,
      publicId: input.publicId,
      patternType: input.patternType,
      versionNumber,
      isCurrent: true,
      name: input.name,
      description: input.description,
      designReference: input.designReference,
      htmlStructure: input.htmlStructure,
      phpPath: input.phpPath,
      scssReference: input.scssReference,
      jsDependencies: [...input.jsDependencies],
      responsiveBehavior: input.responsiveBehavior,
      accessibilityNotes: input.accessibilityNotes,
      browserSupport: input.browserSupport,
      tokenReferences: [...input.tokenReferences],
      relatedComponentIds: [...input.relatedComponentIds],
      approvalStatus: "draft",
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    };
  }

  /** Starts a brand-new logical record: a fresh `recordId`, `versionNumber: 1`, `isCurrent: true`,
   *  `approvalStatus: "draft"`. `recordId` is generated here (not left to a database default)
   *  since `createNewVersion()` later needs to reuse the exact same value across every version
   *  row of the same record. Input shape is derived from `SectionPatternVersionRowInput` (single
   *  source of truth for the field list — code-review fix: the three call-site shapes previously
   *  hand-typed the same field list independently, with mismatched optionality). */
  async create(
    input: Pick<SectionPatternVersionRowInput, "publicId" | "patternType" | "name"> &
      Partial<
        Omit<SectionPatternVersionRowInput, "publicId" | "patternType" | "name" | "createdBy">
      > & { createdBy?: string | null },
  ): Promise<SectionPatternRecordEntity> {
    const instance = await this.model.create(
      this.buildVersionRow(
        {
          publicId: input.publicId,
          patternType: input.patternType,
          name: input.name,
          description: input.description ?? null,
          designReference: input.designReference ?? null,
          htmlStructure: input.htmlStructure ?? null,
          phpPath: input.phpPath ?? null,
          scssReference: input.scssReference ?? null,
          jsDependencies: input.jsDependencies ?? [],
          responsiveBehavior: input.responsiveBehavior ?? null,
          accessibilityNotes: input.accessibilityNotes ?? null,
          browserSupport: input.browserSupport ?? null,
          tokenReferences: input.tokenReferences ?? [],
          relatedComponentIds: input.relatedComponentIds ?? [],
          createdBy: input.createdBy ?? null,
        },
        randomUUID(),
        1,
      ),
    );
    return toEntityWithIsoDates<SectionPatternRecordEntity>(instance);
  }

  /** Inserts a NEW version row of an EXISTING logical record — `recordId` is the caller's
   *  (copied forward from the record's own current version, never generated fresh here), and
   *  `patternType`/`publicId` are likewise copied forward, both immutable across a record's own
   *  version chain. Always `isCurrent: true`/`approvalStatus: "draft"` — the caller
   *  (`SectionPatternsService.update()`) is responsible for flipping the OLD current row's
   *  `isCurrent` to `false` in the SAME transaction (via `updateInPlace()`), so exactly one row
   *  per `recordId` is ever `isCurrent = true` at a time. */
  async createNewVersion(
    input: Omit<SectionPatternVersionRowInput, "createdBy"> & {
      readonly recordId: string;
      readonly versionNumber: number;
      readonly createdBy?: string | null;
    },
    transaction?: Transaction,
  ): Promise<SectionPatternRecordEntity> {
    const instance = await this.model.create(
      this.buildVersionRow(
        {
          publicId: input.publicId,
          patternType: input.patternType,
          name: input.name,
          description: input.description,
          designReference: input.designReference,
          htmlStructure: input.htmlStructure,
          phpPath: input.phpPath,
          scssReference: input.scssReference,
          jsDependencies: input.jsDependencies,
          responsiveBehavior: input.responsiveBehavior,
          accessibilityNotes: input.accessibilityNotes,
          browserSupport: input.browserSupport,
          tokenReferences: input.tokenReferences,
          relatedComponentIds: input.relatedComponentIds,
          createdBy: input.createdBy ?? null,
        },
        input.recordId,
        input.versionNumber,
      ),
      { transaction },
    );
    return toEntityWithIsoDates<SectionPatternRecordEntity>(instance);
  }

  async findCurrentByRecordId(recordId: string): Promise<SectionPatternRecordEntity | null> {
    const instance = await this.model.findOne({ where: { recordId, isCurrent: true } });
    return instance ? toEntityWithIsoDates<SectionPatternRecordEntity>(instance) : null;
  }

  async findCurrentByPublicId(publicId: string): Promise<SectionPatternRecordEntity | null> {
    const instance = await this.model.findOne({ where: { publicId, isCurrent: true } });
    return instance ? toEntityWithIsoDates<SectionPatternRecordEntity>(instance) : null;
  }

  /** Every row (every version) of one logical record, oldest first. An empty array means the
   *  `recordId` has never existed — the service layer (`listVersions()`) turns that into a clean
   *  404, distinct from a `recordId` that exists but happens to have no rows matching some other
   *  filter (there is no such filter here — every row for a known `recordId` is always returned). */
  async listVersions(recordId: string): Promise<readonly SectionPatternRecordEntity[]> {
    const rows = await this.model.findAll({
      where: { recordId },
      order: [["versionNumber", "ASC"]],
    });
    return rows.map((row) => toEntityWithIsoDates<SectionPatternRecordEntity>(row));
  }

  /** Lists CURRENT versions only (`isCurrent = true`), matching every sibling `list()`'s own
   *  "list only shows the live/current state" convention. */
  async list(
    filter: SectionPatternRecordListFilter = {},
  ): Promise<readonly SectionPatternRecordEntity[]> {
    const where: Record<string, unknown> = { isCurrent: true };
    if (filter.patternType) {
      where.patternType = filter.patternType;
    }
    if (filter.approvalStatus) {
      where.approvalStatus = filter.approvalStatus;
    }
    if (filter.search) {
      where.name = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two
      // separate paginated queries, matching DesignTokenRepository's/WebsiteStrategyRecordRepository's
      // own precedent.
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<SectionPatternRecordEntity>(row));
  }

  /**
   * A plain, generic `UPDATE ... WHERE id = ... RETURNING`, scoped to one physical row (a single
   * version). Used two ways by the service layer: (1) content edits on a non-approved current
   * row, and (2) flipping the OLD current row's `isCurrent` to `false` when a new version is
   * created (`isCurrent`/`updatedBy`), inside the same transaction as `createNewVersion()`.
   * `approvalStatus` is deliberately never accepted here — only `updateApprovalStatus()` may
   * change it, same discipline as every sibling module's own `update()`.
   */
  async updateInPlace(
    id: string,
    patch: Partial<{
      name: string;
      description: string | null;
      designReference: string | null;
      htmlStructure: string | null;
      phpPath: string | null;
      scssReference: string | null;
      jsDependencies: readonly string[] | null;
      responsiveBehavior: string | null;
      accessibilityNotes: string | null;
      browserSupport: string | null;
      tokenReferences: readonly string[] | null;
      relatedComponentIds: readonly string[] | null;
      isCurrent: boolean;
      updatedBy: string | null;
    }>,
    transaction?: Transaction,
    expectedApprovalStatus?: SectionPatternApprovalStatus,
  ): Promise<SectionPatternRecordEntity | null> {
    const where: Record<string, unknown> = { id };
    if (expectedApprovalStatus) {
      // A CAS guard, mirroring updateApprovalStatus()'s own conditional-UPDATE pattern — the
      // caller (SectionPatternsService.update()'s non-approved edit branch) passes the
      // approvalStatus it observed at read time, so a concurrent approval landing between that
      // read and this write makes this a no-op (0 affected rows) instead of silently mutating a
      // row that just became approved.
      where.approvalStatus = expectedApprovalStatus;
    }
    const { jsDependencies, tokenReferences, relatedComponentIds, ...rest } = patch;
    const values: Record<string, unknown> = { ...rest };
    // An explicit `null` clears each array field to `[]`, matching create()'s own null/undefined
    // -> [] fallback — these fields are never actually nullable in storage, only
    // omittable-or-clearable at the API layer (mirrors DesignTokenRepository.updateInPlace()'s own
    // fix for the identical spread-of-null hazard).
    if (jsDependencies !== undefined) {
      values.jsDependencies = jsDependencies ? [...jsDependencies] : [];
    }
    if (tokenReferences !== undefined) {
      values.tokenReferences = tokenReferences ? [...tokenReferences] : [];
    }
    if (relatedComponentIds !== undefined) {
      values.relatedComponentIds = relatedComponentIds ? [...relatedComponentIds] : [];
    }
    const [affectedCount, affectedRows] = await this.model.update(values, {
      where,
      returning: true,
      transaction,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<SectionPatternRecordEntity>(affectedRows[0]);
  }

  /** Atomic compare-and-swap on `(id, approvalStatus)` — mirrors
   *  `DesignTokenRepository.updateApprovalStatus()`'s/`WebsiteStrategyRecordRepository.updateApprovalStatus()`'s
   *  own conditional-`UPDATE` pattern exactly, which itself mirrors
   *  `IdempotencyKeyRepository.reserve()`. Prevents two concurrent approvers from both reading the
   *  same `expectedCurrentStatus` and both "succeeding". Accepts an optional `transaction` so a
   *  successful `-> approved` transition can compose with `supersedeOtherApprovedVersion()` inside
   *  one atomic unit. */
  async updateApprovalStatus(
    id: string,
    expectedCurrentStatus: SectionPatternApprovalStatus,
    nextStatus: SectionPatternApprovalStatus,
    updatedBy: string | null,
    transaction?: Transaction,
  ): Promise<UpdateSectionPatternApprovalStatusResult> {
    const [affectedCount, affectedRows] = await this.model.update(
      { approvalStatus: nextStatus, updatedBy },
      { where: { id, approvalStatus: expectedCurrentStatus }, returning: true, transaction },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<SectionPatternRecordEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id }, transaction });
    if (!current) {
      return { outcome: "not_found" };
    }
    return {
      outcome: "conflict",
      entity: toEntityWithIsoDates<SectionPatternRecordEntity>(current),
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
