import { Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getKeywordAndEntityLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { KeywordApprovalStatus, KeywordConfidence, KeywordEntity } from "./entities.js";

/** Every field a caller may set/change on create, i.e. `KeywordEntity` minus its server-only-
 *  managed columns (`id`, `approvalStatus`, `createdAt`, `updatedAt`) — derived, not hand-retyped,
 *  mirroring `PageContentFields`'s own precedent
 *  (`packages/database/src/page-inventory/page.repository.ts`). */
type KeywordContentFields = Omit<
  KeywordEntity,
  "id" | "approvalStatus" | "createdAt" | "updatedAt"
>;

/** `update()`'s patch shape: every content field is optional (a partial edit); `publicId` and
 *  `projectId` are excluded — both immutable after create, mirroring `PageUpdateFields`'s own
 *  precedent (a keyword never moves between projects). */
type KeywordUpdateFields = Omit<KeywordContentFields, "publicId" | "projectId">;

export interface KeywordListFilter {
  /** Required — keywords are project-scoped (task package D2); there is no cross-project "list
   *  every keyword" concept in this module. */
  readonly projectId: string;
  readonly keywordType?: string;
  readonly intent?: string;
  readonly funnelStage?: string;
  readonly country?: string;
  readonly confidence?: KeywordConfidence;
  readonly approvalStatus?: KeywordApprovalStatus;
  /** Fuzzy match on `queryText` (uses the `pg_trgm` index). */
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateKeywordStatusResult =
  | { readonly outcome: "updated"; readonly entity: KeywordEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: KeywordEntity };

// Mirrors PageRepository's/ProofClaimRepository's own DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT clamping
// pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

export class KeywordRepository {
  private readonly model = getKeywordAndEntityLibraryModels().Keyword;

  async create(
    input: Partial<KeywordContentFields> &
      Pick<KeywordContentFields, "projectId" | "publicId" | "queryText">,
  ): Promise<KeywordEntity> {
    const instance = await this.model.create({
      projectId: input.projectId,
      publicId: input.publicId,
      queryText: input.queryText,
      keywordType: input.keywordType ?? null,
      intent: input.intent ?? null,
      funnelStage: input.funnelStage ?? null,
      country: input.country ?? null,
      searchVolume: input.searchVolume ?? null,
      difficultyScore: input.difficultyScore ?? null,
      source: input.source ?? null,
      researchDate: input.researchDate ?? null,
      cannibalizationNotes: input.cannibalizationNotes ?? null,
      confidence: input.confidence ?? null,
      approvalStatus: "draft",
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<KeywordEntity>(instance);
  }

  async findById(id: string): Promise<KeywordEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<KeywordEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<KeywordEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<KeywordEntity>(instance) : null;
  }

  async list(filter: KeywordListFilter): Promise<readonly KeywordEntity[]> {
    const where: Record<string, unknown> = { projectId: filter.projectId };
    if (filter.keywordType) {
      where.keywordType = filter.keywordType;
    }
    if (filter.intent) {
      where.intent = filter.intent;
    }
    if (filter.funnelStage) {
      where.funnelStage = filter.funnelStage;
    }
    if (filter.country) {
      where.country = filter.country;
    }
    if (filter.confidence) {
      where.confidence = filter.confidence;
    }
    if (filter.approvalStatus) {
      where.approvalStatus = filter.approvalStatus;
    }
    if (filter.search) {
      where.queryText = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
    }

    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two separate
      // paginated queries, matching PageRepository's/ProofClaimRepository's own precedent.
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<KeywordEntity>(row));
  }

  /**
   * Content update — `approvalStatus` is deliberately never accepted here; only `updateStatus()`
   * may change it, same discipline as `PageRepository.update()`/`PersonaRepository.update()`. A
   * single atomic `UPDATE ... RETURNING`, not a separate `findOne()` + `instance.update()`.
   */
  async update(
    id: string,
    patch: Partial<KeywordUpdateFields>,
    expectedApprovalStatus?: KeywordApprovalStatus,
  ): Promise<KeywordEntity | null> {
    const where: Record<string, unknown> = { id };
    if (expectedApprovalStatus) {
      // A CAS guard, mirroring PageRepository.update()'s own expectedWorkflowStage parameter and
      // WebsiteStrategyRecordRepository.updateInPlace()'s own expectedApprovalStatus parameter —
      // this project's own already-fixed precedent for the identical bug class (a security-review
      // finding, first shipped on Page Inventory): without it, a concurrent changeApprovalStatus()
      // transition (its own atomic CAS via updateStatus()) landing between the service's
      // findById() read and this write would let an in-place edit silently succeed against what is
      // now an archived/superseded row.
      where.approvalStatus = expectedApprovalStatus;
    }
    const [affectedCount, affectedRows] = await this.model.update(patch, {
      where,
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<KeywordEntity>(affectedRows[0]);
  }

  /** Atomic compare-and-swap on `(id, approvalStatus)` — mirrors `PageRepository.updateStatus()`'s/
   *  `ProofClaimRepository.updateStatus()`'s own conditional-`UPDATE` pattern exactly, which itself
   *  mirrors `IdempotencyKeyRepository.reserve()`. Prevents two concurrent reviewers from both
   *  reading the same `expectedCurrentStatus` and both "succeeding". */
  async updateStatus(
    id: string,
    expectedCurrentStatus: KeywordApprovalStatus,
    nextStatus: KeywordApprovalStatus,
    updatedBy: string | null,
  ): Promise<UpdateKeywordStatusResult> {
    const [affectedCount, affectedRows] = await this.model.update(
      { approvalStatus: nextStatus, updatedBy },
      { where: { id, approvalStatus: expectedCurrentStatus }, returning: true },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return { outcome: "updated", entity: toEntityWithIsoDates<KeywordEntity>(affectedRows[0]) };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<KeywordEntity>(current) };
  }
}
