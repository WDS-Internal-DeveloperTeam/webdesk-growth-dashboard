import { Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getProofAndClaimsLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { ProofClaimApprovalStatus, ProofClaimEntity } from "./entities.js";

/** The three array fields additionally accept an explicit `null` — meaning "clear to empty" —
 *  matching the scalar fields' own null-to-clear convention, same shape as
 *  `PersonaRepository`'s `PersonaArrayFieldOverrides`. Applies to both `create()` and `update()`:
 *  on create, `null` is equivalent to omitting the field (both default to `[]`); on update,
 *  `null` actively clears a previously-set value. */
type ProofClaimArrayFieldOverrides = {
  readonly relatedServiceIds?: readonly string[] | null;
  readonly relatedCaseStudyIds?: readonly string[] | null;
  readonly relatedPageIds?: readonly string[] | null;
};

/** Every field a caller may set/change, i.e. `ProofClaimEntity` minus its server-only-managed
 *  columns (`id`, `approvalStatus`, `createdAt`, `updatedAt`) — derived, not hand-retyped, so a
 *  future field added to `ProofClaimEntity` is a compile error here until it's also handled by
 *  `create()`/`update()`, not a silent gap (mirrors `PersonaContentFields`'s own precedent). */
type ProofClaimContentFields = Omit<
  ProofClaimEntity,
  | "id"
  | "approvalStatus"
  | "createdAt"
  | "updatedAt"
  | "relatedServiceIds"
  | "relatedCaseStudyIds"
  | "relatedPageIds"
> &
  ProofClaimArrayFieldOverrides;

/** `update()`'s patch shape: every content field is optional (a partial edit), `publicId` is
 *  excluded (immutable after create). */
type ProofClaimUpdateFields = Omit<ProofClaimContentFields, "publicId">;

export interface ProofClaimListFilter {
  readonly approvalStatus?: ProofClaimApprovalStatus;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdateProofClaimStatusResult =
  | { readonly outcome: "updated"; readonly entity: ProofClaimEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: ProofClaimEntity };

// Mirrors PersonaRepository's/ServiceRepository's own DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT
// clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** No `projectId` scoping anywhere here — this module's records are organization-wide, not tied
 *  to a `projects` row, matching Service Library/Business Knowledge Center/Persona Library. */
export class ProofClaimRepository {
  private readonly model = getProofAndClaimsLibraryModels().ProofClaim;

  async create(
    input: Partial<ProofClaimContentFields> & Pick<ProofClaimContentFields, "publicId" | "claim">,
  ): Promise<ProofClaimEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      claim: input.claim,
      claimType: input.claimType ?? null,
      beforeValue: input.beforeValue ?? null,
      afterValue: input.afterValue ?? null,
      verificationStatus: input.verificationStatus ?? "unverified",
      approvedWording: input.approvedWording ?? null,
      restrictions: input.restrictions ?? null,
      expiryReviewDate: input.expiryReviewDate ?? null,
      relatedServiceIds: input.relatedServiceIds ?? [],
      relatedCaseStudyIds: input.relatedCaseStudyIds ?? [],
      relatedPageIds: input.relatedPageIds ?? [],
      approvalStatus: "draft",
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<ProofClaimEntity>(instance);
  }

  async findById(id: string): Promise<ProofClaimEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<ProofClaimEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<ProofClaimEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<ProofClaimEntity>(instance) : null;
  }

  async list(filter: ProofClaimListFilter = {}): Promise<readonly ProofClaimEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.approvalStatus) {
      where.approvalStatus = filter.approvalStatus;
    }
    if (filter.search) {
      where.claim = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two
      // separate paginated queries, matching PersonaRepository's own precedent.
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<ProofClaimEntity>(row));
  }

  /**
   * Content update — `approvalStatus` is deliberately never accepted here; only
   * `updateStatus()` may change it, same discipline as `PersonaRepository.update()`. Unlike
   * `PersonaRepository`, there is no `version` field to increment (the canonical spec names no
   * such field for proof claims), so this is a plain `UPDATE` with `returning: true`.
   */
  async update(
    id: string,
    patch: Partial<ProofClaimUpdateFields>,
  ): Promise<ProofClaimEntity | null> {
    // The three array columns are NOT NULL — an explicit `null` in the patch means "clear to
    // empty", not "store null"; `undefined` (the key omitted entirely) is left untouched, leaving
    // the column unchanged, same as every other field — mirrors PersonaRepository.update()'s own
    // normalization exactly.
    const normalized: Record<string, unknown> = { ...patch };
    if (patch.relatedServiceIds !== undefined) {
      normalized.relatedServiceIds = patch.relatedServiceIds ?? [];
    }
    if (patch.relatedCaseStudyIds !== undefined) {
      normalized.relatedCaseStudyIds = patch.relatedCaseStudyIds ?? [];
    }
    if (patch.relatedPageIds !== undefined) {
      normalized.relatedPageIds = patch.relatedPageIds ?? [];
    }

    const [affectedCount, affectedRows] = await this.model.update(normalized, {
      where: { id },
      returning: true,
    });
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<ProofClaimEntity>(affectedRows[0]);
  }

  /** Atomic compare-and-swap on `(id, approvalStatus)` — mirrors
   *  `PersonaRepository.updateStatus()`'s/`ServiceRepository.updateStatus()`'s own conditional-
   *  `UPDATE` pattern exactly, which itself mirrors `IdempotencyKeyRepository.reserve()`. Prevents
   *  two concurrent approvers from both reading the same `expectedCurrentStatus` and both
   *  "succeeding". */
  async updateStatus(
    id: string,
    expectedCurrentStatus: ProofClaimApprovalStatus,
    nextStatus: ProofClaimApprovalStatus,
    updatedBy: string | null,
  ): Promise<UpdateProofClaimStatusResult> {
    const [affectedCount, affectedRows] = await this.model.update(
      { approvalStatus: nextStatus, updatedBy },
      { where: { id, approvalStatus: expectedCurrentStatus }, returning: true },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<ProofClaimEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<ProofClaimEntity>(current) };
  }
}
