import { randomUUID } from "node:crypto";
import { Op, type Transaction } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getComponentLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ComponentApprovalStatus, ComponentEntity } from "./entities.js";

export interface ComponentListFilter {
  readonly category?: string;
  readonly approvalStatus?: ComponentApprovalStatus;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateComponentApprovalStatusResult =
  | { readonly outcome: "updated"; readonly entity: ComponentEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: ComponentEntity };

// Mirrors DesignTokenRepository's/WebsiteStrategyRecordRepository's own DEFAULT_LIST_LIMIT/
// MAX_LIST_LIMIT clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/**
 * No `projectId` scoping anywhere here — this module's records are organization-wide, matching
 * every other library-shaped module (design decision, scope doc).
 *
 * File-for-file mirrors `DesignTokenRepository` — implements REAL version history (design
 * decision 1): `create()` starts a brand-new logical record (a fresh `recordId`,
 * `versionNumber: 1`). Editing an already-`approved` current version does NOT call `create()`
 * again — it calls `updateInPlace()` (to flip the old row's `isCurrent` to `false`) and
 * `createNewVersion()` (to insert the new draft version row) together, inside one caller-supplied
 * transaction — the SERVICE layer (`ComponentsService`) opens `withTransaction()` and threads the
 * `Transaction` handle through multiple separate repository calls, not a single repository method
 * that opens its own transaction internally.
 */
interface ComponentVersionRowInput {
  readonly publicId: string;
  readonly category: string;
  readonly name: string;
  readonly figmaReference: string | null;
  readonly tokenIds: readonly string[];
  readonly htmlStructure: string | null;
  readonly phpPath: string | null;
  readonly scssClassesPath: string | null;
  readonly jsDependencies: string | null;
  readonly states: string | null;
  readonly responsiveBehavior: string | null;
  readonly browserSupport: string | null;
  readonly accessibility: string | null;
  readonly schema: string | null;
  readonly analytics: string | null;
  readonly tests: string | null;
  readonly replacementRecordId: string | null;
  readonly createdBy: string | null;
}

export class ComponentRepository {
  private readonly model = getComponentLibraryModels().Component;

  /** Shared row-builder for both `create()` (a brand-new logical record) and `createNewVersion()`
   *  (a new version row of an existing one) — mirrors
   *  `DesignTokenRepository.buildVersionRow()`'s own reasoning: the two previously
   *  hand-duplicated the identical field list, a real risk that a field added to one and not the
   *  other silently drops a caller-supplied value on whichever path was missed. `recordId`/
   *  `versionNumber`/`isCurrent` are supplied per-call, not by this helper, since they differ by
   *  construction between the two callers. */
  private buildVersionRow(
    input: ComponentVersionRowInput,
    recordId: string,
    versionNumber: number,
  ): Record<string, unknown> {
    return {
      recordId,
      publicId: input.publicId,
      category: input.category,
      versionNumber,
      isCurrent: true,
      name: input.name,
      figmaReference: input.figmaReference,
      tokenIds: [...input.tokenIds],
      htmlStructure: input.htmlStructure,
      phpPath: input.phpPath,
      scssClassesPath: input.scssClassesPath,
      jsDependencies: input.jsDependencies,
      states: input.states,
      responsiveBehavior: input.responsiveBehavior,
      browserSupport: input.browserSupport,
      accessibility: input.accessibility,
      schema: input.schema,
      analytics: input.analytics,
      tests: input.tests,
      replacementRecordId: input.replacementRecordId,
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
    category: string;
    name: string;
    figmaReference?: string | null;
    tokenIds?: readonly string[];
    htmlStructure?: string | null;
    phpPath?: string | null;
    scssClassesPath?: string | null;
    jsDependencies?: string | null;
    states?: string | null;
    responsiveBehavior?: string | null;
    browserSupport?: string | null;
    accessibility?: string | null;
    schema?: string | null;
    analytics?: string | null;
    tests?: string | null;
    replacementRecordId?: string | null;
    createdBy?: string | null;
  }): Promise<ComponentEntity> {
    const instance = await this.model.create(
      this.buildVersionRow(
        {
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
          createdBy: input.createdBy ?? null,
        },
        randomUUID(),
        1,
      ),
    );
    return toEntityWithIsoDates<ComponentEntity>(instance);
  }

  /** Inserts a NEW version row of an EXISTING logical record — `recordId` is the caller's
   *  (copied forward from the record's own current version, never generated fresh here), and
   *  `category`/`publicId` are likewise copied forward, both immutable across a record's own
   *  version chain. Always `isCurrent: true`/`approvalStatus: "draft"` — the caller
   *  (`ComponentsService.update()`) is responsible for flipping the OLD current row's `isCurrent`
   *  to `false` in the SAME transaction (via `updateInPlace()`), so exactly one row per `recordId`
   *  is ever `isCurrent = true` at a time. */
  async createNewVersion(
    input: {
      recordId: string;
      publicId: string;
      category: string;
      versionNumber: number;
      name: string;
      figmaReference: string | null;
      tokenIds: readonly string[];
      htmlStructure: string | null;
      phpPath: string | null;
      scssClassesPath: string | null;
      jsDependencies: string | null;
      states: string | null;
      responsiveBehavior: string | null;
      browserSupport: string | null;
      accessibility: string | null;
      schema: string | null;
      analytics: string | null;
      tests: string | null;
      replacementRecordId: string | null;
      createdBy?: string | null;
    },
    transaction?: Transaction,
  ): Promise<ComponentEntity> {
    const instance = await this.model.create(
      this.buildVersionRow(
        {
          publicId: input.publicId,
          category: input.category,
          name: input.name,
          figmaReference: input.figmaReference,
          tokenIds: input.tokenIds,
          htmlStructure: input.htmlStructure,
          phpPath: input.phpPath,
          scssClassesPath: input.scssClassesPath,
          jsDependencies: input.jsDependencies,
          states: input.states,
          responsiveBehavior: input.responsiveBehavior,
          browserSupport: input.browserSupport,
          accessibility: input.accessibility,
          schema: input.schema,
          analytics: input.analytics,
          tests: input.tests,
          replacementRecordId: input.replacementRecordId,
          createdBy: input.createdBy ?? null,
        },
        input.recordId,
        input.versionNumber,
      ),
      { transaction },
    );
    return toEntityWithIsoDates<ComponentEntity>(instance);
  }

  async findCurrentByRecordId(recordId: string): Promise<ComponentEntity | null> {
    const instance = await this.model.findOne({ where: { recordId, isCurrent: true } });
    return instance ? toEntityWithIsoDates<ComponentEntity>(instance) : null;
  }

  async findCurrentByPublicId(publicId: string): Promise<ComponentEntity | null> {
    const instance = await this.model.findOne({ where: { publicId, isCurrent: true } });
    return instance ? toEntityWithIsoDates<ComponentEntity>(instance) : null;
  }

  /** Every row (every version) of one logical record, oldest first. An empty array means the
   *  `recordId` has never existed — the service layer (`listVersions()`) turns that into a clean
   *  404, distinct from a `recordId` that exists but happens to have no rows matching some other
   *  filter (there is no such filter here — every row for a known `recordId` is always returned). */
  async listVersions(recordId: string): Promise<readonly ComponentEntity[]> {
    const rows = await this.model.findAll({
      where: { recordId },
      order: [["versionNumber", "ASC"]],
    });
    return rows.map((row) => toEntityWithIsoDates<ComponentEntity>(row));
  }

  /** Lists CURRENT versions only (`isCurrent = true`), matching every sibling `list()`'s own
   *  "list only shows the live/current state" convention. */
  async list(filter: ComponentListFilter = {}): Promise<readonly ComponentEntity[]> {
    const where: Record<string, unknown> = { isCurrent: true };
    if (filter.category) {
      where.category = filter.category;
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
      // separate paginated queries, matching DesignTokenRepository's own precedent.
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<ComponentEntity>(row));
  }

  /**
   * Every CURRENT-version row whose `recordId` is in `recordIds` — used by
   * `DesignTokensService`... no, used cross-module the OTHER direction is not applicable here;
   * this is Component Library's OWN existence check for `replacementRecordId` (in-module, so this
   * method also doubles as the general "does this recordId exist" lookup a future cross-module
   * consumer could use, mirroring `ServiceRepository.findByIds()`'s shape). Returns only the
   * subset of `recordIds` that resolve to a real, current component.
   */
  async findByIds(recordIds: readonly string[]): Promise<readonly ComponentEntity[]> {
    if (recordIds.length === 0) {
      return [];
    }
    const rows = await this.model.findAll({
      where: { recordId: { [Op.in]: [...recordIds] }, isCurrent: true },
    });
    return rows.map((row) => toEntityWithIsoDates<ComponentEntity>(row));
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
      figmaReference: string | null;
      tokenIds: readonly string[] | null;
      htmlStructure: string | null;
      phpPath: string | null;
      scssClassesPath: string | null;
      jsDependencies: string | null;
      states: string | null;
      responsiveBehavior: string | null;
      browserSupport: string | null;
      accessibility: string | null;
      schema: string | null;
      analytics: string | null;
      tests: string | null;
      replacementRecordId: string | null;
      isCurrent: boolean;
      updatedBy: string | null;
    }>,
    transaction?: Transaction,
    expectedApprovalStatus?: ComponentApprovalStatus,
  ): Promise<ComponentEntity | null> {
    const where: Record<string, unknown> = { id };
    if (expectedApprovalStatus) {
      // A CAS guard, mirroring updateApprovalStatus()'s own conditional-UPDATE pattern — the
      // caller (ComponentsService.update()'s non-approved edit branch) passes the approvalStatus
      // it observed at read time, so a concurrent approval landing between that read and this
      // write makes this a no-op (0 affected rows) instead of silently mutating a row that just
      // became approved.
      where.approvalStatus = expectedApprovalStatus;
    }
    const { tokenIds, ...rest } = patch;
    const values: Record<string, unknown> = { ...rest };
    if (tokenIds !== undefined) {
      // An explicit `null` clears to `[]`, matching create()'s own null/undefined -> [] fallback
      // — tokenIds is never actually nullable in storage, only omittable-or-clearable at the API
      // layer (mirrors DesignTokenRepository.updateInPlace()'s own identical fix: a naive
      // `[...tokenIds]` here would throw on `null`, since spreading `null` is not iterable).
      values.tokenIds = tokenIds ? [...tokenIds] : [];
    }
    const [affectedCount, affectedRows] = await this.model.update(values, {
      where,
      returning: true,
      transaction,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<ComponentEntity>(affectedRows[0]);
  }

  /** Atomic compare-and-swap on `(id, approvalStatus)` — mirrors
   *  `DesignTokenRepository.updateApprovalStatus()`'s own conditional-`UPDATE` pattern exactly,
   *  which itself mirrors `IdempotencyKeyRepository.reserve()`. Prevents two concurrent approvers
   *  from both reading the same `expectedCurrentStatus` and both "succeeding". Accepts an optional
   *  `transaction` so a successful `-> approved` transition can compose with
   *  `supersedeOtherApprovedVersion()` inside one atomic unit. */
  async updateApprovalStatus(
    id: string,
    expectedCurrentStatus: ComponentApprovalStatus,
    nextStatus: ComponentApprovalStatus,
    updatedBy: string | null,
    transaction?: Transaction,
  ): Promise<UpdateComponentApprovalStatusResult> {
    const [affectedCount, affectedRows] = await this.model.update(
      { approvalStatus: nextStatus, updatedBy },
      { where: { id, approvalStatus: expectedCurrentStatus }, returning: true, transaction },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<ComponentEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id }, transaction });
    if (!current) {
      return { outcome: "not_found" };
    }
    return {
      outcome: "conflict",
      entity: toEntityWithIsoDates<ComponentEntity>(current),
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
