import { literal, Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getPersonaLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { PersonaApprovalStatus, PersonaEntity } from "./entities.js";

export interface PersonaListFilter {
  readonly approvalStatus?: PersonaApprovalStatus;
  readonly search?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export type UpdatePersonaStatusResult =
  | { readonly outcome: "updated"; readonly entity: PersonaEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: PersonaEntity };

// Mirrors ServiceRepository's own DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT clamping pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** No `projectId` scoping anywhere here — this module's records are organization-wide, not tied
 *  to a `projects` row (D8). */
export class PersonaRepository {
  private readonly model = getPersonaLibraryModels().Persona;

  async create(input: {
    publicId: string;
    name: string;
    buyerType?: string | null;
    companySize?: string | null;
    roles?: readonly string[];
    industries?: readonly string[];
    geography?: string | null;
    goals?: string | null;
    pains?: string | null;
    triggers?: string | null;
    objections?: string | null;
    decisionCriteria?: string | null;
    relatedServiceIds?: readonly string[];
    badFitSignals?: string | null;
    messagingTrack?: string | null;
    ctaPreferences?: string | null;
    createdBy?: string | null;
  }): Promise<PersonaEntity> {
    const instance = await this.model.create({
      publicId: input.publicId,
      name: input.name,
      buyerType: input.buyerType ?? null,
      companySize: input.companySize ?? null,
      roles: input.roles ?? [],
      industries: input.industries ?? [],
      geography: input.geography ?? null,
      goals: input.goals ?? null,
      pains: input.pains ?? null,
      triggers: input.triggers ?? null,
      objections: input.objections ?? null,
      decisionCriteria: input.decisionCriteria ?? null,
      relatedServiceIds: input.relatedServiceIds ?? [],
      badFitSignals: input.badFitSignals ?? null,
      messagingTrack: input.messagingTrack ?? null,
      ctaPreferences: input.ctaPreferences ?? null,
      approvalStatus: "draft",
      version: 1,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<PersonaEntity>(instance);
  }

  async findById(id: string): Promise<PersonaEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<PersonaEntity>(instance) : null;
  }

  async findByPublicId(publicId: string): Promise<PersonaEntity | null> {
    const instance = await this.model.findOne({ where: { publicId } });
    return instance ? toEntityWithIsoDates<PersonaEntity>(instance) : null;
  }

  async list(filter: PersonaListFilter = {}): Promise<readonly PersonaEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.approvalStatus) {
      where.approvalStatus = filter.approvalStatus;
    }
    if (filter.search) {
      where.name = { [Op.iLike]: `%${escapeLikePattern(filter.search)}%` };
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      order: [["updatedAt", "DESC"]],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<PersonaEntity>(row));
  }

  /**
   * Content update — `approvalStatus` is deliberately never accepted here (D4); only
   * `updateStatus()` may change it. `version` is server-managed: incremented by 1 as part of the
   * same `UPDATE` statement via a Postgres-evaluated `version + 1` literal (D5) — avoiding a
   * read-then-write race the same way `ServiceRepository.updateStatus()`'s own compare-and-swap
   * does, and `returning: true` (mirrors `SessionExchangeCodeRepository.redeem()`'s own pattern)
   * gets the post-update row, including the server-computed `version`, back from the `UPDATE`
   * itself rather than a second round trip.
   */
  async update(
    id: string,
    patch: Partial<{
      name: string;
      buyerType: string | null;
      companySize: string | null;
      roles: readonly string[];
      industries: readonly string[];
      geography: string | null;
      goals: string | null;
      pains: string | null;
      triggers: string | null;
      objections: string | null;
      decisionCriteria: string | null;
      relatedServiceIds: readonly string[];
      badFitSignals: string | null;
      messagingTrack: string | null;
      ctaPreferences: string | null;
      updatedBy: string | null;
    }>,
  ): Promise<PersonaEntity | null> {
    const [affectedCount, affectedRows] = await this.model.update(
      { ...patch, version: literal("version + 1") },
      { where: { id }, returning: true },
    );
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<PersonaEntity>(affectedRows[0]);
  }

  /** Atomic compare-and-swap on `(id, approvalStatus)` — mirrors
   *  `ServiceRepository.updateStatus()`'s own conditional-`UPDATE` pattern exactly (D3), which
   *  itself mirrors `IdempotencyKeyRepository.reserve()`. Prevents two concurrent approvers from
   *  both reading the same `expectedCurrentStatus` and both "succeeding". Does not touch
   *  `version` — only content edits via `update()` increment it (D4/D5). */
  async updateStatus(
    id: string,
    expectedCurrentStatus: PersonaApprovalStatus,
    nextStatus: PersonaApprovalStatus,
    updatedBy: string | null,
  ): Promise<UpdatePersonaStatusResult> {
    const [affectedCount] = await this.model.update(
      { approvalStatus: nextStatus, updatedBy },
      { where: { id, approvalStatus: expectedCurrentStatus } },
    );
    if (affectedCount > 0) {
      const instance = await this.model.findByPk(id);
      // Can't be missing: the UPDATE above just matched this exact id.
      return { outcome: "updated", entity: toEntityWithIsoDates<PersonaEntity>(instance!) };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<PersonaEntity>(current) };
  }
}
