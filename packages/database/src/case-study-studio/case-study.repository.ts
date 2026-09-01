import { literal, Op, type Transaction } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getCaseStudyStudioModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { CaseStudyEntity, CaseStudyStatus } from "./entities.js";

/** The two array fields additionally accept an explicit `null` — meaning "clear to empty" —
 *  matching the scalar fields' own null-to-clear convention, same shape as
 *  `ProofClaimRepository`'s `ProofClaimArrayFieldOverrides`. */
type CaseStudyArrayFieldOverrides = {
  readonly relatedServiceIds?: readonly string[] | null;
  readonly relatedClaimIds?: readonly string[] | null;
};

/** Every field a caller may set/change, i.e. `CaseStudyEntity` minus its server-only-managed
 *  columns (`id`, `status`, `publishedAt`, `version`, `createdAt`, `updatedAt`) — derived, not
 *  hand-retyped, mirroring `ProofClaimContentFields`'s own precedent, so a future field added to
 *  `CaseStudyEntity` is a compile error here until it's also handled by `create()`/`update()`. */
type CaseStudyContentFields = Omit<
  CaseStudyEntity,
  | "id"
  | "status"
  | "publishedAt"
  | "version"
  | "createdAt"
  | "updatedAt"
  | "relatedServiceIds"
  | "relatedClaimIds"
> &
  CaseStudyArrayFieldOverrides;

/** `update()`'s patch shape: every content field is optional (a partial edit), `publicId` is
 *  excluded (immutable after create). */
type CaseStudyUpdateFields = Omit<CaseStudyContentFields, "publicId">;

export interface CaseStudyListFilter {
  readonly status?: CaseStudyStatus;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateCaseStudyStatusResult =
  | {
      readonly outcome: "updated";
      readonly entity: CaseStudyEntity;
    }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: CaseStudyEntity };

/** Extra columns a status transition may write in the same atomic `UPDATE` as the CAS guard —
 *  `publishedAt`/`unpublishReason` on the publish/unpublish transitions specifically. */
export interface UpdateCaseStudyStatusExtra {
  readonly publishedAt?: Date;
  readonly unpublishReason?: string | null;
}

// Mirrors ProofClaimRepository's/PersonaRepository's own DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT
// clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** No `projectId` scoping anywhere here — this module's records are organization-wide, matching
 *  Persona/Service/Proof and Claims Library. */
export class CaseStudyRepository {
  private readonly model = getCaseStudyStudioModels().CaseStudy;

  async create(
    input: Partial<CaseStudyContentFields> &
      Pick<CaseStudyContentFields, "publicId" | "clientName" | "projectTitle">,
  ): Promise<CaseStudyEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      clientName: input.clientName,
      projectTitle: input.projectTitle,
      industry: input.industry ?? null,
      platform: input.platform ?? null,
      visibility: input.visibility ?? "internal_only",
      embargoDate: input.embargoDate ?? null,
      challenge: input.challenge ?? null,
      solution: input.solution ?? null,
      implementation: input.implementation ?? null,
      results: input.results ?? null,
      relatedServiceIds: input.relatedServiceIds ?? [],
      relatedClaimIds: input.relatedClaimIds ?? [],
      assignedReviewerUserId: input.assignedReviewerUserId ?? null,
      clientApprovalRequired: input.clientApprovalRequired ?? false,
      status: "intake",
      scheduledPublishAt: input.scheduledPublishAt ?? null,
      publishedAt: null,
      unpublishReason: null,
      version: 1,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<CaseStudyEntity>(instance);
  }

  async findById(id: string, transaction?: Transaction): Promise<CaseStudyEntity | null> {
    const instance = await this.model.findByPk(id, { transaction });
    return instance ? toEntityWithIsoDates<CaseStudyEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<CaseStudyEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<CaseStudyEntity>(instance) : null;
  }

  async list(filter: CaseStudyListFilter = {}): Promise<readonly CaseStudyEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.search) {
      const pattern = `%${escapeLikePattern(filter.search)}%`;
      where[Op.or as unknown as string] = [
        { clientName: { [Op.iLike]: pattern } },
        { projectTitle: { [Op.iLike]: pattern } },
      ];
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
    return rows.map((row) => toEntityWithIsoDates<CaseStudyEntity>(row));
  }

  /**
   * Content update — `status`/`publishedAt` are deliberately never accepted here; only
   * `updateStatus()` may change them, same discipline as `ProofClaimRepository.update()`.
   * Increments `version` atomically in the same `UPDATE`, mirroring `PersonaRepository.update()`'s
   * own `version + 1` literal (avoids a read-then-write race on the counter itself).
   */
  async update(id: string, patch: Partial<CaseStudyUpdateFields>): Promise<CaseStudyEntity | null> {
    // The two array columns are NOT NULL — an explicit `null` in the patch means "clear to empty",
    // not "store null"; `undefined` (the key omitted entirely) is left untouched, leaving the
    // column unchanged, same as every other field — mirrors ProofClaimRepository.update()'s own
    // normalization exactly.
    const normalized: Record<string, unknown> = { ...patch };
    if (patch.relatedServiceIds !== undefined) {
      normalized.relatedServiceIds = patch.relatedServiceIds ?? [];
    }
    if (patch.relatedClaimIds !== undefined) {
      normalized.relatedClaimIds = patch.relatedClaimIds ?? [];
    }

    const [affectedCount, affectedRows] = await this.model.update(
      { ...normalized, version: literal("version + 1") },
      { where: { id }, returning: true },
    );
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<CaseStudyEntity>(affectedRows[0]);
  }

  /**
   * Atomic compare-and-swap on `(id, status)` — mirrors `ProofClaimRepository.updateStatus()`'s
   * own conditional-`UPDATE` pattern exactly (itself mirroring `IdempotencyKeyRepository.reserve()`).
   * `extra` carries additional columns to set in the same atomic write (`publishedAt` on a publish
   * transition, `unpublishReason` on an unpublish transition) — never both at once in practice, but
   * both accepted for generality. Accepts an optional `transaction` so the service layer can pair
   * this write with a `case_study_approvals` row insert atomically via `withTransaction()`,
   * mirroring `ReviewRepository.updateStatus()`'s own signature.
   */
  async updateStatus(
    id: string,
    expectedStatus: CaseStudyStatus,
    nextStatus: CaseStudyStatus,
    updatedBy: string | null,
    extra: UpdateCaseStudyStatusExtra = {},
    transaction?: Transaction,
  ): Promise<UpdateCaseStudyStatusResult> {
    const changes: Record<string, unknown> = { status: nextStatus, updatedBy };
    if (extra.publishedAt !== undefined) {
      changes.publishedAt = extra.publishedAt;
    }
    if (extra.unpublishReason !== undefined) {
      changes.unpublishReason = extra.unpublishReason;
    }

    const [affectedCount, affectedRows] = await this.model.update(changes, {
      where: { id, status: expectedStatus },
      returning: true,
      transaction,
    });
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<CaseStudyEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id }, transaction });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<CaseStudyEntity>(current) };
  }
}
