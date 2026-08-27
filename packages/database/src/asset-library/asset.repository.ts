import { literal, Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getAssetLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type {
  AssetApprovalStatus,
  AssetEntity,
  AssetScanStatus,
  AssetVisibility,
} from "./entities.js";

/** Every field a caller may set/change on create, i.e. `AssetEntity` minus its server-only-managed
 *  columns (`id`, `scanStatus`, `approvalStatus`, `version`, `isPublished`, `publishedAt`,
 *  `createdAt`, `updatedAt`) — derived, not hand-retyped, mirroring
 *  `BrandLibraryRecordContentFields`'s own precedent, so a future field added to `AssetEntity` is
 *  a compile error here until it's also handled by `create()`/`update()`, not a silent gap.
 *
 *  `scanStatus` is in the omit list deliberately (D4): it is server-managed, never caller input. */
type AssetContentFields = Omit<
  AssetEntity,
  | "id"
  | "scanStatus"
  | "approvalStatus"
  | "version"
  | "isPublished"
  | "publishedAt"
  | "createdAt"
  | "updatedAt"
>;

/** `update()`'s patch shape: every content field is optional (a partial edit), `publicId` is
 *  excluded (immutable after create — never regenerated once assigned, matching
 *  `BrandLibraryRecordUpdateFields`'s own identical treatment of the same column). */
type AssetUpdateFields = Omit<AssetContentFields, "publicId">;

export interface AssetListFilter {
  readonly approvalStatus?: AssetApprovalStatus;
  readonly visibility?: AssetVisibility;
  readonly scanStatus?: AssetScanStatus;
  readonly mimeType?: string;
  readonly isPublished?: boolean;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateAssetStatusResult =
  | { readonly outcome: "updated"; readonly entity: AssetEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: AssetEntity };

export type UpdateAssetPublishStateResult =
  | { readonly outcome: "updated"; readonly entity: AssetEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: AssetEntity };

// Mirrors BrandLibraryRecordRepository's/ContentTemplateRepository's own DEFAULT_LIST_LIMIT/
// MAX_LIST_LIMIT clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** No `projectId` scoping anywhere here — this module's records are organization-wide, matching
 *  Brand Library's/Content Template Library's/Persona Library's/Service Library's own precedent
 *  (D9). */
export class AssetRepository {
  private readonly model = getAssetLibraryModels().Asset;

  async create(
    input: Partial<AssetContentFields> & Pick<AssetContentFields, "publicId" | "title">,
  ): Promise<AssetEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      title: input.title,
      description: input.description ?? null,
      fileReference: input.fileReference ?? null,
      mimeType: input.mimeType ?? null,
      fileSizeBytes: input.fileSizeBytes ?? null,
      checksum: input.checksum ?? null,
      widthPx: input.widthPx ?? null,
      heightPx: input.heightPx ?? null,
      durationSeconds: input.durationSeconds ?? null,
      licence: input.licence ?? null,
      licenceHolder: input.licenceHolder ?? null,
      consentReference: input.consentReference ?? null,
      altTextGuidance: input.altTextGuidance ?? null,
      // Defaults to `internal` when the caller says nothing — deliberately the conservative middle
      // value, never `public`, so an asset is never accidentally created world-visible (D2).
      visibility: input.visibility ?? "internal",
      retentionNote: input.retentionNote ?? null,
      // Server-managed (D4). Hardcoded here rather than accepted from `input` — no scanner exists,
      // so nothing may claim any other value, least of all `clean`.
      scanStatus: "not_configured",
      approvalStatus: "draft",
      version: 1,
      isPublished: false,
      publishedAt: null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<AssetEntity>(instance);
  }

  async findById(id: string): Promise<AssetEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<AssetEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<AssetEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<AssetEntity>(instance) : null;
  }

  async list(filter: AssetListFilter = {}): Promise<readonly AssetEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.approvalStatus) {
      where.approvalStatus = filter.approvalStatus;
    }
    if (filter.visibility) {
      where.visibility = filter.visibility;
    }
    if (filter.scanStatus) {
      where.scanStatus = filter.scanStatus;
    }
    if (filter.mimeType) {
      where.mimeType = filter.mimeType;
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
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two separate
      // paginated queries, matching BrandLibraryRecordRepository's own precedent (an already-fixed
      // bug class in this codebase's history).
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<AssetEntity>(row));
  }

  /**
   * Content update — `scanStatus`/`approvalStatus`/`isPublished`/`publishedAt` are deliberately
   * never accepted here (D4/D5/D6); only `updateApprovalStatus()`/`updatePublishState()` may
   * change the latter three, and nothing at all writes `scanStatus` today. `version` is
   * server-managed: incremented by 1 as part of the same `UPDATE` statement via a
   * Postgres-evaluated `version + 1` literal (D5), with `returning: true` getting the post-update
   * row (including the server-computed `version`) back from the `UPDATE` itself rather than a
   * second round trip — mirrors `BrandLibraryRecordRepository.update()`'s own identical pattern.
   *
   * `expectedApprovalStatus` is an optional CAS guard, mirroring
   * `BrandLibraryRecordRepository.update()`'s own identical parameter (a previously-fixed bug
   * class in this codebase): without it, `AssetsService.update()`'s own terminal-state check reads
   * `approvalStatus` into application memory, but the actual write here would still be
   * unconditional — a concurrent `updateApprovalStatus()` transition landing between that read and
   * this write could let an edit silently succeed against what is now an archived/superseded row.
   */
  async update(
    id: string,
    patch: Partial<AssetUpdateFields>,
    expectedApprovalStatus?: AssetApprovalStatus,
  ): Promise<AssetEntity | null> {
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
    return toEntityWithIsoDates<AssetEntity>(affectedRows[0]);
  }

  /** Atomic compare-and-swap on `(id, approvalStatus)` — mirrors
   *  `BrandLibraryRecordRepository.updateApprovalStatus()`'s own conditional-`UPDATE` pattern
   *  exactly, which itself mirrors `IdempotencyKeyRepository.reserve()`. Prevents two concurrent
   *  approvers from both reading the same `expectedCurrentStatus` and both "succeeding". Does not
   *  touch `version` — only content edits via `update()` increment it (D5) — and does not touch
   *  `isPublished`/`publishedAt`, which are orthogonal (D6). */
  async updateApprovalStatus(
    id: string,
    expectedCurrentStatus: AssetApprovalStatus,
    nextStatus: AssetApprovalStatus,
    updatedBy: string | null,
  ): Promise<UpdateAssetStatusResult> {
    const [affectedCount, affectedRows] = await this.model.update(
      { approvalStatus: nextStatus, updatedBy },
      { where: { id, approvalStatus: expectedCurrentStatus }, returning: true },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return { outcome: "updated", entity: toEntityWithIsoDates<AssetEntity>(affectedRows[0]) };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<AssetEntity>(current) };
  }

  /**
   * Atomic compare-and-swap on `(id, isPublished)` — mirrors
   * `BrandLibraryRecordRepository.updatePublishState()`'s own conditional-`UPDATE`-plus-
   * conditional-`COALESCE`-stamp pattern exactly (D6), itself mirroring
   * `IdempotencyKeyRepository.reserve()`. Prevents a concurrent double-publish or double-unpublish
   * from both reading the same `expectedIsPublished` and both "succeeding".
   *
   * When `nextIsPublished === true`, `publishedAt` is stamped in the SAME atomic `UPDATE` via
   * `COALESCE("published_at", NOW())` — "stamp once, never overwrite": a later
   * unpublish-then-republish cycle does NOT reset `publishedAt` to the later time. When
   * `nextIsPublished === false`, `publishedAt` is left untouched entirely (no assignment at all,
   * not even a no-op one), preserving it as permanent history of the first publish.
   *
   * `expectedApprovalStatus` is an optional second CAS guard, passed only by `publish()` (D6's
   * "only an `approved` asset may be published" rule) — `unpublish()` never passes it, since D6
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
    expectedApprovalStatus?: AssetApprovalStatus,
  ): Promise<UpdateAssetPublishStateResult> {
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
      return { outcome: "updated", entity: toEntityWithIsoDates<AssetEntity>(affectedRows[0]) };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<AssetEntity>(current) };
  }
}
