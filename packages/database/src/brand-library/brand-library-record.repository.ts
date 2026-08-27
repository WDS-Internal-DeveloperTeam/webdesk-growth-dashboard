import { literal, Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getBrandLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type {
  BrandLibraryApprovalStatus,
  BrandLibraryRecordEntity,
  BrandLibraryRecordType,
} from "./entities.js";

/** Every field a caller may set/change on create, i.e. `BrandLibraryRecordEntity` minus its
 *  server-only-managed columns (`id`, `approvalStatus`, `version`, `isPublished`, `publishedAt`,
 *  `createdAt`, `updatedAt`) — derived, not hand-retyped, mirroring
 *  `ContentTemplateContentFields`'s own precedent, so a future field added to
 *  `BrandLibraryRecordEntity` is a compile error here until it's also handled by
 *  `create()`/`update()`, not a silent gap. */
type BrandLibraryRecordContentFields = Omit<
  BrandLibraryRecordEntity,
  "id" | "approvalStatus" | "version" | "isPublished" | "publishedAt" | "createdAt" | "updatedAt"
>;

/** `update()`'s patch shape: every content field is optional (a partial edit), `publicId` and
 *  `recordType` are excluded (both immutable after create — `recordType` per D1, since the
 *  module's discriminator column governs which fields make sense on a record and changing it
 *  after creation would be a different record, never accepted through the update route,
 *  mirroring Website Strategy Center's own identical `recordType`-immutable precedent). */
type BrandLibraryRecordUpdateFields = Omit<
  BrandLibraryRecordContentFields,
  "publicId" | "recordType"
>;

export interface BrandLibraryRecordListFilter {
  readonly recordType?: BrandLibraryRecordType;
  readonly approvalStatus?: BrandLibraryApprovalStatus;
  readonly isPublished?: boolean;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateBrandLibraryRecordStatusResult =
  | { readonly outcome: "updated"; readonly entity: BrandLibraryRecordEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: BrandLibraryRecordEntity };

export type UpdateBrandLibraryRecordPublishStateResult =
  | { readonly outcome: "updated"; readonly entity: BrandLibraryRecordEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: BrandLibraryRecordEntity };

// Mirrors ContentTemplateRepository's/PersonaRepository's own DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT
// clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** No `projectId` scoping anywhere here — this module's records are organization-wide, matching
 *  Content Template Library's/Persona Library's/Service Library's own precedent (D1). */
export class BrandLibraryRecordRepository {
  private readonly model = getBrandLibraryModels().BrandLibraryRecord;

  async create(
    input: Partial<BrandLibraryRecordContentFields> &
      Pick<BrandLibraryRecordContentFields, "publicId" | "recordType" | "title">,
  ): Promise<BrandLibraryRecordEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      recordType: input.recordType,
      title: input.title,
      description: input.description ?? null,
      fileReference: input.fileReference ?? null,
      usageNotes: input.usageNotes ?? null,
      approvalStatus: "draft",
      version: 1,
      isPublished: false,
      publishedAt: null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<BrandLibraryRecordEntity>(instance);
  }

  async findById(id: string): Promise<BrandLibraryRecordEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<BrandLibraryRecordEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<BrandLibraryRecordEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<BrandLibraryRecordEntity>(instance) : null;
  }

  async list(
    filter: BrandLibraryRecordListFilter = {},
  ): Promise<readonly BrandLibraryRecordEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.recordType) {
      where.recordType = filter.recordType;
    }
    if (filter.approvalStatus) {
      where.approvalStatus = filter.approvalStatus;
    }
    if (filter.isPublished !== undefined) {
      where.isPublished = filter.isPublished;
    }
    if (filter.search) {
      where.title = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two
      // separate paginated queries, matching ContentTemplateRepository's/PersonaRepository's own
      // precedent (an already-fixed bug class in this codebase's history).
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<BrandLibraryRecordEntity>(row));
  }

  /**
   * Content update — `approvalStatus`/`isPublished`/`publishedAt` are deliberately never accepted
   * here (D4/D5); only `updateApprovalStatus()`/`updatePublishState()` may change those. `version`
   * is server-managed: incremented by 1 as part of the same `UPDATE` statement via a
   * Postgres-evaluated `version + 1` literal (D6), with `returning: true` getting the post-update
   * row (including the server-computed `version`) back from the `UPDATE` itself rather than a
   * second round trip — mirrors `ContentTemplateRepository.update()`'s own identical pattern.
   *
   * `expectedApprovalStatus` is an optional CAS guard, mirroring
   * `ContentTemplateRepository.update()`'s own `expectedApprovalStatus` parameter (a
   * previously-fixed bug class in this codebase): without it, `BrandLibraryService.update()`'s own
   * terminal-state check reads `approvalStatus` into application memory, but the actual write here
   * would still be unconditional — a concurrent `updateApprovalStatus()` transition landing
   * between that read and this write could let an edit silently succeed against what is now an
   * archived/superseded row.
   */
  async update(
    id: string,
    patch: Partial<BrandLibraryRecordUpdateFields>,
    expectedApprovalStatus?: BrandLibraryApprovalStatus,
  ): Promise<BrandLibraryRecordEntity | null> {
    const where: Record<string, unknown> = { id };
    if (expectedApprovalStatus) {
      where.approvalStatus = expectedApprovalStatus;
    }
    const [affectedCount, affectedRows] = await this.model.update(
      { ...patch, version: literal("version + 1") },
      { where, returning: true },
    );
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<BrandLibraryRecordEntity>(affectedRows[0]);
  }

  /** Atomic compare-and-swap on `(id, approvalStatus)` — mirrors
   *  `ContentTemplateRepository.updateApprovalStatus()`'s own conditional-`UPDATE` pattern
   *  exactly, which itself mirrors `IdempotencyKeyRepository.reserve()`. Prevents two concurrent
   *  approvers from both reading the same `expectedCurrentStatus` and both "succeeding". Does not
   *  touch `version` — only content edits via `update()` increment it (D4/D6), and does not touch
   *  `isPublished`/`publishedAt` — orthogonal (D5). */
  async updateApprovalStatus(
    id: string,
    expectedCurrentStatus: BrandLibraryApprovalStatus,
    nextStatus: BrandLibraryApprovalStatus,
    updatedBy: string | null,
  ): Promise<UpdateBrandLibraryRecordStatusResult> {
    const [affectedCount, affectedRows] = await this.model.update(
      { approvalStatus: nextStatus, updatedBy },
      { where: { id, approvalStatus: expectedCurrentStatus }, returning: true },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<BrandLibraryRecordEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return {
      outcome: "conflict",
      entity: toEntityWithIsoDates<BrandLibraryRecordEntity>(current),
    };
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
   * succeed, since `isPublished` alone was still `false`.
   */
  async updatePublishState(
    id: string,
    expectedIsPublished: boolean,
    nextIsPublished: boolean,
    updatedBy: string | null,
    expectedApprovalStatus?: BrandLibraryApprovalStatus,
  ): Promise<UpdateBrandLibraryRecordPublishStateResult> {
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
        entity: toEntityWithIsoDates<BrandLibraryRecordEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return {
      outcome: "conflict",
      entity: toEntityWithIsoDates<BrandLibraryRecordEntity>(current),
    };
  }
}
