import { randomUUID } from "node:crypto";
import { Op, type Transaction } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getDesignTokenLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type {
  DesignTokenApprovalStatus,
  DesignTokenEntity,
  DesignTokenGroup,
  DesignTokenThemeVariation,
} from "./entities.js";

export interface DesignTokenListFilter {
  readonly group?: DesignTokenGroup;
  readonly approvalStatus?: DesignTokenApprovalStatus;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateDesignTokenApprovalStatusResult =
  | { readonly outcome: "updated"; readonly entity: DesignTokenEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: DesignTokenEntity };

// Mirrors WebsiteStrategyRecordRepository's/ProofClaimRepository's/PersonaRepository's own
// DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/**
 * No `projectId` scoping anywhere here — this module's records are organization-wide, matching
 * every other library-shaped module (design decision, task package/scope doc).
 *
 * File-for-file mirrors `WebsiteStrategyRecordRepository` — implements REAL version history
 * (design decision 1): `create()` starts a brand-new logical record (a fresh `recordId`,
 * `versionNumber: 1`). Editing an already-`approved` current version does NOT call `create()`
 * again — it calls `updateInPlace()` (to flip the old row's `isCurrent` to `false`) and
 * `createNewVersion()` (to insert the new draft version row) together, inside one caller-supplied
 * transaction — the SERVICE layer (`DesignTokensService`) opens `withTransaction()` and threads
 * the `Transaction` handle through multiple separate repository calls, not a single repository
 * method that opens its own transaction internally.
 */
interface DesignTokenVersionRowInput {
  readonly publicId: string;
  readonly group: DesignTokenGroup;
  readonly name: string;
  readonly value: string;
  readonly unit: string | null;
  readonly semanticPurpose: string | null;
  readonly responsiveVariation: string | null;
  readonly themeVariation: DesignTokenThemeVariation | null;
  readonly usageReferences: readonly string[];
  readonly createdBy: string | null;
}

export class DesignTokenRepository {
  private readonly model = getDesignTokenLibraryModels().DesignToken;

  /** Shared row-builder for both `create()` (a brand-new logical record) and `createNewVersion()`
   *  (a new version row of an existing one) — the two previously hand-duplicated the identical
   *  field list, a real risk that a field added to one and not the other silently drops a
   *  caller-supplied value (allowNull columns with no defaultValue store NULL, no error) on
   *  whichever path was missed (code-review fix). `recordId`/`versionNumber`/`isCurrent` are
   *  supplied per-call, not by this helper, since they differ by construction between the two
   *  callers. */
  private buildVersionRow(
    input: DesignTokenVersionRowInput,
    recordId: string,
    versionNumber: number,
  ): Record<string, unknown> {
    return {
      recordId,
      publicId: input.publicId,
      group: input.group,
      versionNumber,
      isCurrent: true,
      name: input.name,
      value: input.value,
      unit: input.unit,
      semanticPurpose: input.semanticPurpose,
      responsiveVariation: input.responsiveVariation,
      themeVariation: input.themeVariation,
      usageReferences: [...input.usageReferences],
      approvalStatus: "draft",
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    };
  }

  /** Starts a brand-new logical record: a fresh `recordId`, `versionNumber: 1`, `isCurrent: true`,
   *  `approvalStatus: "draft"`. `recordId` is generated here (not left to a database default)
   *  since `createNewVersion()` later needs to reuse the exact same value across every version
   *  row of the same record. */
  async create(input: {
    publicId: string;
    group: DesignTokenGroup;
    name: string;
    value: string;
    unit?: string | null;
    semanticPurpose?: string | null;
    responsiveVariation?: string | null;
    themeVariation?: DesignTokenThemeVariation | null;
    usageReferences?: readonly string[];
    createdBy?: string | null;
  }): Promise<DesignTokenEntity> {
    const instance = await this.model.create(
      this.buildVersionRow(
        {
          publicId: input.publicId,
          group: input.group,
          name: input.name,
          value: input.value,
          unit: input.unit ?? null,
          semanticPurpose: input.semanticPurpose ?? null,
          responsiveVariation: input.responsiveVariation ?? null,
          themeVariation: input.themeVariation ?? null,
          usageReferences: input.usageReferences ?? [],
          createdBy: input.createdBy ?? null,
        },
        randomUUID(),
        1,
      ),
    );
    return toEntityWithIsoDates<DesignTokenEntity>(instance);
  }

  /** Inserts a NEW version row of an EXISTING logical record — `recordId` is the caller's
   *  (copied forward from the record's own current version, never generated fresh here), and
   *  `group`/`publicId` are likewise copied forward, both immutable across a record's own
   *  version chain. Always `isCurrent: true`/`approvalStatus: "draft"` — the caller
   *  (`DesignTokensService.update()`) is responsible for flipping the OLD current row's
   *  `isCurrent` to `false` in the SAME transaction (via `updateInPlace()`), so exactly one row
   *  per `recordId` is ever `isCurrent = true` at a time. */
  async createNewVersion(
    input: {
      recordId: string;
      publicId: string;
      group: DesignTokenGroup;
      versionNumber: number;
      name: string;
      value: string;
      unit: string | null;
      semanticPurpose: string | null;
      responsiveVariation: string | null;
      themeVariation: DesignTokenThemeVariation | null;
      usageReferences: readonly string[];
      createdBy?: string | null;
    },
    transaction?: Transaction,
  ): Promise<DesignTokenEntity> {
    const instance = await this.model.create(
      this.buildVersionRow(
        {
          publicId: input.publicId,
          group: input.group,
          name: input.name,
          value: input.value,
          unit: input.unit,
          semanticPurpose: input.semanticPurpose,
          responsiveVariation: input.responsiveVariation,
          themeVariation: input.themeVariation,
          usageReferences: input.usageReferences,
          createdBy: input.createdBy ?? null,
        },
        input.recordId,
        input.versionNumber,
      ),
      { transaction },
    );
    return toEntityWithIsoDates<DesignTokenEntity>(instance);
  }

  async findCurrentByRecordId(recordId: string): Promise<DesignTokenEntity | null> {
    const instance = await this.model.findOne({ where: { recordId, isCurrent: true } });
    return instance ? toEntityWithIsoDates<DesignTokenEntity>(instance) : null;
  }

  async findCurrentByPublicId(publicId: string): Promise<DesignTokenEntity | null> {
    const instance = await this.model.findOne({ where: { publicId, isCurrent: true } });
    return instance ? toEntityWithIsoDates<DesignTokenEntity>(instance) : null;
  }

  /** Every row (every version) of one logical record, oldest first. An empty array means the
   *  `recordId` has never existed — the service layer (`listVersions()`) turns that into a clean
   *  404, distinct from a `recordId` that exists but happens to have no rows matching some other
   *  filter (there is no such filter here — every row for a known `recordId` is always returned). */
  async listVersions(recordId: string): Promise<readonly DesignTokenEntity[]> {
    const rows = await this.model.findAll({
      where: { recordId },
      order: [["versionNumber", "ASC"]],
    });
    return rows.map((row) => toEntityWithIsoDates<DesignTokenEntity>(row));
  }

  /** Lists CURRENT versions only (`isCurrent = true`), matching every sibling `list()`'s own
   *  "list only shows the live/current state" convention. */
  async list(filter: DesignTokenListFilter = {}): Promise<readonly DesignTokenEntity[]> {
    const where: Record<string, unknown> = { isCurrent: true };
    if (filter.group) {
      where.group = filter.group;
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
      // separate paginated queries, matching WebsiteStrategyRecordRepository's own precedent.
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<DesignTokenEntity>(row));
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
      value: string;
      unit: string | null;
      semanticPurpose: string | null;
      responsiveVariation: string | null;
      themeVariation: DesignTokenThemeVariation | null;
      usageReferences: readonly string[] | null;
      isCurrent: boolean;
      updatedBy: string | null;
    }>,
    transaction?: Transaction,
    expectedApprovalStatus?: DesignTokenApprovalStatus,
  ): Promise<DesignTokenEntity | null> {
    const where: Record<string, unknown> = { id };
    if (expectedApprovalStatus) {
      // A CAS guard, mirroring updateApprovalStatus()'s own conditional-UPDATE pattern — the
      // caller (DesignTokensService.update()'s non-approved edit branch) passes the
      // approvalStatus it observed at read time, so a concurrent approval landing between that
      // read and this write makes this a no-op (0 affected rows) instead of silently mutating a
      // row that just became approved.
      where.approvalStatus = expectedApprovalStatus;
    }
    const { usageReferences, ...rest } = patch;
    const values: Record<string, unknown> = { ...rest };
    if (usageReferences !== undefined) {
      // An explicit `null` clears to `[]`, matching create()'s own null/undefined -> [] fallback
      // — usageReferences is never actually nullable in storage, only omittable-or-clearable at
      // the API layer (code-review fix: a naive `[...usageReferences]` here would throw on
      // `null`, since spreading `null` is not iterable).
      values.usageReferences = usageReferences ? [...usageReferences] : [];
    }
    const [affectedCount, affectedRows] = await this.model.update(values, {
      where,
      returning: true,
      transaction,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<DesignTokenEntity>(affectedRows[0]);
  }

  /** Atomic compare-and-swap on `(id, approvalStatus)` — mirrors
   *  `WebsiteStrategyRecordRepository.updateApprovalStatus()`'s/`ProofClaimRepository.updateStatus()`'s/
   *  `PersonaRepository.updateStatus()`'s/`ServiceRepository.updateStatus()`'s own
   *  conditional-`UPDATE` pattern exactly, which itself mirrors `IdempotencyKeyRepository.reserve()`.
   *  Prevents two concurrent approvers from both reading the same `expectedCurrentStatus` and both
   *  "succeeding". Accepts an optional `transaction` so a successful `-> approved` transition can
   *  compose with `supersedeOtherApprovedVersion()` inside one atomic unit. */
  async updateApprovalStatus(
    id: string,
    expectedCurrentStatus: DesignTokenApprovalStatus,
    nextStatus: DesignTokenApprovalStatus,
    updatedBy: string | null,
    transaction?: Transaction,
  ): Promise<UpdateDesignTokenApprovalStatusResult> {
    const [affectedCount, affectedRows] = await this.model.update(
      { approvalStatus: nextStatus, updatedBy },
      { where: { id, approvalStatus: expectedCurrentStatus }, returning: true, transaction },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<DesignTokenEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id }, transaction });
    if (!current) {
      return { outcome: "not_found" };
    }
    return {
      outcome: "conflict",
      entity: toEntityWithIsoDates<DesignTokenEntity>(current),
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
