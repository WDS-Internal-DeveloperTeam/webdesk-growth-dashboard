import { Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getSystemSettingModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { SystemSettingEntity, SystemSettingType } from "./entities.js";

/** Every field a caller may set on create, i.e. `SystemSettingEntity` minus its server-only-
 *  managed columns (`id`, `isActive`, `createdAt`, `updatedAt`) — derived, not hand-retyped,
 *  mirroring `BrandLibraryRecordContentFields`'s own precedent, so a future field added to
 *  `SystemSettingEntity` is a compile error here until it's also handled by
 *  `create()`/`update()`, not a silent gap. */
type SystemSettingContentFields = Omit<
  SystemSettingEntity,
  "id" | "isActive" | "createdAt" | "updatedAt"
>;

/** `update()`'s patch shape: every content field is optional (a partial edit), `publicId` and
 *  `settingType` are excluded (both immutable after create — `settingType` per D1, since the
 *  module's discriminator column governs which fields make sense on a record and changing it
 *  after creation would be a different record, never accepted through the update route, mirroring
 *  `BrandLibraryRecordUpdateFields`'s own identical `recordType`-immutable precedent). `key` stays
 *  editable — a real Git-rule typo can be corrected without deleting and recreating the row. */
type SystemSettingUpdateFields = Omit<SystemSettingContentFields, "publicId" | "settingType">;

export interface SystemSettingListFilter {
  readonly settingType?: SystemSettingType;
  readonly isActive?: boolean;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateSystemSettingActiveStateResult =
  | { readonly outcome: "updated"; readonly entity: SystemSettingEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: SystemSettingEntity };

// Mirrors BrandLibraryRecordRepository's/ContentTemplateRepository's own
// DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** No `projectId` scoping anywhere here — this module's records are organization-wide, matching
 *  Content Template Library's/Persona Library's/Service Library's/Brand Library's own precedent. */
export class SystemSettingRepository {
  private readonly model = getSystemSettingModels().SystemSetting;

  async create(
    input: Partial<SystemSettingContentFields> &
      Pick<SystemSettingContentFields, "publicId" | "settingType" | "key" | "value">,
  ): Promise<SystemSettingEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      settingType: input.settingType,
      key: input.key,
      value: input.value,
      description: input.description ?? null,
      isActive: true,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<SystemSettingEntity>(instance);
  }

  async findById(id: string): Promise<SystemSettingEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<SystemSettingEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<SystemSettingEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<SystemSettingEntity>(instance) : null;
  }

  /** Looks a setting up by its stable `(settingType, key)` pair (D3) — the whole point of `key`
   *  being a human-assigned slug rather than an opaque UUID. Also used by `create()`'s own
   *  pre-write uniqueness check. */
  async findByTypeAndKey(
    settingType: SystemSettingType,
    key: string,
  ): Promise<SystemSettingEntity | null> {
    const instance = await this.model.findOne({ where: { settingType, key } });
    return instance ? toEntityWithIsoDates<SystemSettingEntity>(instance) : null;
  }

  async list(filter: SystemSettingListFilter = {}): Promise<readonly SystemSettingEntity[]> {
    const where: Record<string | symbol, unknown> = {};
    if (filter.settingType) {
      where.settingType = filter.settingType;
    }
    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }
    if (filter.search) {
      const pattern = `%${escapeLikePattern(filter.search)}%`;
      where[Op.or] = [{ key: { [Op.iLike]: pattern } }, { description: { [Op.iLike]: pattern } }];
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two
      // separate paginated queries, matching BrandLibraryRecordRepository's/
      // ContentTemplateRepository's own precedent (an already-fixed bug class in this codebase's
      // history — a real production incident on the Decision and Activity Log module).
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<SystemSettingEntity>(row));
  }

  /**
   * Content update — `isActive` is deliberately never accepted here (D4); only
   * `updateActiveState()` may change it. No terminal-state/CAS guard is needed on this write —
   * unlike Brand Library's `approvalStatus`-gated `update()`, this module has no approval
   * workflow and no state that makes a record permanently uneditable, so a plain `WHERE id`
   * write is sufficient.
   */
  async update(
    id: string,
    patch: Partial<SystemSettingUpdateFields>,
  ): Promise<SystemSettingEntity | null> {
    const [affectedCount, affectedRows] = await this.model.update(patch, {
      where: { id },
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<SystemSettingEntity>(affectedRows[0]);
  }

  /**
   * Atomic compare-and-swap on `(id, isActive)` (D4) — mirrors
   * `BrandLibraryRecordRepository.updatePublishState()`'s own conditional-`UPDATE` pattern
   * (itself mirroring `IdempotencyKeyRepository.reserve()`), but simpler: a single boolean
   * toggle, not a publish/unpublish pair, and no `publishedAt`-style stamp-once timestamp to
   * manage. `expectedIsActive` is optional — when omitted, the write is unconditional on `id`
   * alone (a plain "set to this value" call); when provided, it closes the same class of
   * concurrent-write race Brand Library's own CAS guards were added to prevent (two concurrent
   * callers both reading the same stale `isActive` and both "succeeding").
   */
  async updateActiveState(
    id: string,
    nextIsActive: boolean,
    updatedBy: string | null,
    expectedIsActive?: boolean,
  ): Promise<UpdateSystemSettingActiveStateResult> {
    const where: Record<string, unknown> = { id };
    if (expectedIsActive !== undefined) {
      where.isActive = expectedIsActive;
    }
    const [affectedCount, affectedRows] = await this.model.update(
      { isActive: nextIsActive, updatedBy },
      { where, returning: true },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<SystemSettingEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return {
      outcome: "conflict",
      entity: toEntityWithIsoDates<SystemSettingEntity>(current),
    };
  }
}
