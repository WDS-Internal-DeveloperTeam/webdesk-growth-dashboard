import { literal, Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getPortfolioLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { PortfolioApprovalStatus, PortfolioRecordEntity } from "./entities.js";

/** `additionalCategories`/`tags`/`relatedProofIds` are all genuinely NOT NULL array columns — an
 *  explicit `null` in a patch means "clear to empty", not "store null", mirroring
 *  `CaseStudyRepository`'s own `CaseStudyArrayFieldOverrides` shape exactly. */
type PortfolioArrayFieldOverrides = {
  readonly additionalCategories?: readonly string[] | null;
  readonly tags?: readonly string[] | null;
  readonly relatedProofIds?: readonly string[] | null;
};

/** Every field a caller may set/change on create, i.e. `PortfolioRecordEntity` minus its
 *  server-only-managed columns (`id`, `approvalStatus`, `isPublished`, `publishedAt`, `version`,
 *  `createdAt`, `updatedAt`) — derived, not hand-retyped, mirroring `ContentTemplateContentFields`'s
 *  own precedent, so a future field added to `PortfolioRecordEntity` is a compile error here until
 *  it's also handled by `create()`/`update()`, not a silent gap. */
type PortfolioContentFields = Omit<
  PortfolioRecordEntity,
  | "id"
  | "approvalStatus"
  | "isPublished"
  | "publishedAt"
  | "version"
  | "createdAt"
  | "updatedAt"
  | "additionalCategories"
  | "tags"
  | "relatedProofIds"
> &
  PortfolioArrayFieldOverrides;

/** `update()`'s patch shape: every content field is optional (a partial edit), `publicId` is
 *  excluded (immutable after create). */
type PortfolioUpdateFields = Omit<PortfolioContentFields, "publicId">;

export interface PortfolioRecordListFilter {
  readonly approvalStatus?: PortfolioApprovalStatus;
  readonly isPublished?: boolean;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdatePortfolioApprovalStatusResult =
  | { readonly outcome: "updated"; readonly entity: PortfolioRecordEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: PortfolioRecordEntity };

export type UpdatePortfolioPublishStateResult =
  | { readonly outcome: "updated"; readonly entity: PortfolioRecordEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: PortfolioRecordEntity };

// Mirrors ContentTemplateRepository's/CaseStudyRepository's own DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT
// clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** No `projectId` scoping anywhere here — this module's records are organization-wide (D1). */
export class PortfolioRecordRepository {
  private readonly model = getPortfolioLibraryModels().PortfolioRecord;

  async create(
    input: Partial<PortfolioContentFields> &
      Pick<PortfolioContentFields, "publicId" | "projectOrClientName">,
  ): Promise<PortfolioRecordEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      projectOrClientName: input.projectOrClientName,
      url: input.url ?? null,
      primaryCategory: input.primaryCategory ?? null,
      additionalCategories: input.additionalCategories ?? [],
      tags: input.tags ?? [],
      industry: input.industry ?? null,
      platform: input.platform ?? null,
      serviceType: input.serviceType ?? null,
      launchDate: input.launchDate ?? null,
      relatedProofIds: input.relatedProofIds ?? [],
      visibility: input.visibility ?? "internal_only",
      approvalStatus: "draft",
      isPublished: false,
      publishedAt: null,
      version: 1,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<PortfolioRecordEntity>(instance);
  }

  async findById(id: string): Promise<PortfolioRecordEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<PortfolioRecordEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<PortfolioRecordEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<PortfolioRecordEntity>(instance) : null;
  }

  async list(filter: PortfolioRecordListFilter = {}): Promise<readonly PortfolioRecordEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.approvalStatus) {
      where.approvalStatus = filter.approvalStatus;
    }
    if (filter.isPublished !== undefined) {
      where.isPublished = filter.isPublished;
    }
    if (filter.search) {
      where.projectOrClientName = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two
      // separate paginated queries, matching every sibling module's own established precedent.
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<PortfolioRecordEntity>(row));
  }

  /**
   * Content update — `approvalStatus`/`isPublished`/`publishedAt` are deliberately never accepted
   * here (D5/D6); only `updateApprovalStatus()`/`updatePublishState()` may change those. `version`
   * is server-managed: incremented by 1 as part of the same `UPDATE` statement via a
   * Postgres-evaluated `version + 1` literal (D7), with `returning: true` getting the post-update
   * row (including the server-computed `version`) back from the `UPDATE` itself rather than a
   * second round trip — mirrors `ContentTemplateRepository.update()`'s own identical pattern.
   *
   * `expectedApprovalStatus` is an optional CAS guard, mirroring `ContentTemplateRepository.update()`'s
   * own `expectedApprovalStatus` parameter (a previously-fixed bug class in this codebase,
   * originating from `WebsiteStrategyRecordRepository.updateInPlace()`'s `expectedApprovalStatus`):
   * without it, the service layer's own terminal-state check reads `approvalStatus` into
   * application memory, but the actual write here would still be unconditional — a concurrent
   * `updateApprovalStatus()` transition landing between that read and this write could let an edit
   * silently succeed against what is now an archived/superseded row.
   */
  async update(
    id: string,
    patch: Partial<PortfolioUpdateFields>,
    expectedApprovalStatus?: PortfolioApprovalStatus,
  ): Promise<PortfolioRecordEntity | null> {
    // The three array columns are NOT NULL — an explicit `null` in the patch means "clear to
    // empty", not "store null"; `undefined` (the key omitted entirely) is left untouched, leaving
    // the column unchanged, same as every other field — mirrors `CaseStudyRepository.update()`'s
    // own normalization exactly.
    const normalized: Record<string, unknown> = { ...patch };
    if (patch.additionalCategories !== undefined) {
      normalized.additionalCategories = patch.additionalCategories ?? [];
    }
    if (patch.tags !== undefined) {
      normalized.tags = patch.tags ?? [];
    }
    if (patch.relatedProofIds !== undefined) {
      normalized.relatedProofIds = patch.relatedProofIds ?? [];
    }

    const where: Record<string, unknown> = { id };
    if (expectedApprovalStatus) {
      where.approvalStatus = expectedApprovalStatus;
    }
    const [affectedCount, affectedRows] = await this.model.update(
      { ...normalized, version: literal("version + 1") },
      { where, returning: true },
    );
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<PortfolioRecordEntity>(affectedRows[0]);
  }

  /** Atomic compare-and-swap on `(id, approvalStatus)` — mirrors
   *  `ContentTemplateRepository.updateApprovalStatus()`'s own conditional-`UPDATE` pattern exactly,
   *  which itself mirrors `IdempotencyKeyRepository.reserve()`. Prevents two concurrent approvers
   *  from both reading the same `expectedCurrentStatus` and both "succeeding". Does not touch
   *  `version` — only content edits via `update()` increment it (D6/D7), and does not touch
   *  `isPublished`/`publishedAt` — orthogonal (D5). */
  async updateApprovalStatus(
    id: string,
    expectedCurrentStatus: PortfolioApprovalStatus,
    nextStatus: PortfolioApprovalStatus,
    updatedBy: string | null,
  ): Promise<UpdatePortfolioApprovalStatusResult> {
    const [affectedCount, affectedRows] = await this.model.update(
      { approvalStatus: nextStatus, updatedBy },
      { where: { id, approvalStatus: expectedCurrentStatus }, returning: true },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<PortfolioRecordEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<PortfolioRecordEntity>(current) };
  }

  /**
   * Atomic compare-and-swap on `(id, isPublished)` — mirrors
   * `ContentTemplateRepository.updatePublishState()`'s own conditional-`UPDATE`-plus-conditional-
   * `COALESCE`-stamp pattern exactly (D5), itself mirroring `IdempotencyKeyRepository.reserve()`.
   * Prevents a concurrent double-publish or double-unpublish from both reading the same
   * `expectedIsPublished` and both "succeeding".
   *
   * When `nextIsPublished === true`, `publishedAt` is stamped in the SAME atomic `UPDATE` via
   * `COALESCE("published_at", NOW())` — "stamp once, never overwrite": a later
   * unpublish-then-republish cycle does NOT reset `publishedAt` to the later time. When
   * `nextIsPublished === false`, `publishedAt` is left untouched entirely (no assignment at all,
   * not even a no-op one), preserving it as permanent history of the first publish.
   *
   * `expectedApprovalStatus` is an optional second CAS guard, passed only by `publish()` (D5's
   * "only an `approved` record may be published" rule) — `unpublish()` never passes it, since D5
   * gives unpublish no status restriction. Without it, `publish()`'s own upfront
   * `approvalStatus === "approved"` check reads the status into application memory, but this write
   * would still be unconditional on it — a concurrent `updateApprovalStatus()` transition (e.g.
   * `approved -> archived`) landing between that read and this write could let the publish still
   * succeed, since `isPublished` alone was still `false` — the exact TOCTOU race
   * `ContentTemplateRepository.updatePublishState()`'s own doc comment already documents once.
   */
  async updatePublishState(
    id: string,
    expectedIsPublished: boolean,
    nextIsPublished: boolean,
    updatedBy: string | null,
    expectedApprovalStatus?: PortfolioApprovalStatus,
  ): Promise<UpdatePortfolioPublishStateResult> {
    const values: Record<string, unknown> = { isPublished: nextIsPublished, updatedBy };
    if (nextIsPublished) {
      values.publishedAt = literal('COALESCE("published_at", NOW())');
    }

    const where: Record<string, unknown> = { id, isPublished: expectedIsPublished };
    if (expectedApprovalStatus) {
      where.approvalStatus = expectedApprovalStatus;
    }

    const [affectedCount, affectedRows] = await this.model.update(values, {
      where,
      returning: true,
    });
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<PortfolioRecordEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<PortfolioRecordEntity>(current) };
  }
}
