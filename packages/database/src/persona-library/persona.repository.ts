import { literal, Op } from "sequelize";
import { escapeLikePattern } from "../auth/user.repository.js";
import { getPersonaLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type { PersonaApprovalStatus, PersonaEntity } from "./entities.js";

/** The three array fields additionally accept an explicit `null` — meaning "clear to empty" —
 *  matching the scalar fields' own null-to-clear convention (code-review finding: arrays
 *  previously accepted only `[]` to clear, `null` was rejected with a 400). Applies to both
 *  `create()` and `update()`: on create, `null` is equivalent to omitting the field (both default
 *  to `[]`); on update, `null` actively clears a previously-set value. */
type PersonaArrayFieldOverrides = {
  readonly roles?: readonly string[] | null;
  readonly industries?: readonly string[] | null;
  readonly relatedServiceIds?: readonly string[] | null;
};

/** Every field a caller may set/change, i.e. `PersonaEntity` minus its server-only-managed
 *  columns (`id`, `approvalStatus`, `version`, `createdAt`, `updatedAt`) — derived, not
 *  hand-retyped, so a future field added to `PersonaEntity` is a compile error here until it's
 *  also handled by `create()`/`update()`, not a silent gap (code-review finding). */
type PersonaContentFields = Omit<
  PersonaEntity,
  | "id"
  | "approvalStatus"
  | "version"
  | "createdAt"
  | "updatedAt"
  | "roles"
  | "industries"
  | "relatedServiceIds"
> &
  PersonaArrayFieldOverrides;

/** `update()`'s patch shape: every content field is optional (a partial edit), `publicId` is
 *  excluded (immutable after create). */
type PersonaUpdateFields = Omit<PersonaContentFields, "publicId">;

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

  async create(
    input: Partial<PersonaContentFields> & Pick<PersonaContentFields, "publicId" | "name">,
  ): Promise<PersonaEntity> {
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
      // `id` is a secondary sort key so ties on `updatedAt` (realistic for a bulk import/seed)
      // don't shift order between two separate paginated queries, which could otherwise
      // duplicate or skip a row across pages (code-review finding).
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
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
  async update(id: string, patch: Partial<PersonaUpdateFields>): Promise<PersonaEntity | null> {
    // The three array columns are NOT NULL — an explicit `null` in the patch (see
    // PersonaUpdateFields) means "clear to empty", not "store null", so it's normalized here
    // before the write; `undefined` (the key omitted entirely) is left untouched, leaving the
    // column unchanged, same as every other field.
    const normalized: Record<string, unknown> = { ...patch };
    if (patch.roles !== undefined) {
      normalized.roles = patch.roles ?? [];
    }
    if (patch.industries !== undefined) {
      normalized.industries = patch.industries ?? [];
    }
    if (patch.relatedServiceIds !== undefined) {
      normalized.relatedServiceIds = patch.relatedServiceIds ?? [];
    }

    const [affectedCount, affectedRows] = await this.model.update(
      { ...normalized, version: literal("version + 1") },
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
    // `returning: true` gets the post-update row from the same statement — avoiding both a
    // second round trip and the narrow window a separate `findByPk` read would otherwise leave
    // between this write and reading it back, where a concurrent write could make the entity
    // returned to the caller reflect a different status than the one this call just wrote
    // (code-review finding; mirrors `update()`'s own already-correct use of `returning: true`).
    const [affectedCount, affectedRows] = await this.model.update(
      { approvalStatus: nextStatus, updatedBy },
      { where: { id, approvalStatus: expectedCurrentStatus }, returning: true },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return { outcome: "updated", entity: toEntityWithIsoDates<PersonaEntity>(affectedRows[0]) };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return { outcome: "conflict", entity: toEntityWithIsoDates<PersonaEntity>(current) };
  }
}
