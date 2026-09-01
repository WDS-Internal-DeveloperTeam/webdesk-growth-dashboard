import { literal } from "sequelize";
import { getKnowledgeLibraryModels } from "./models.js";
import { toEntityWithIsoDates } from "./entity-mapping.js";
import type {
  KnowledgeLibraryRecordConfidentiality,
  KnowledgeLibraryRecordEntity,
  KnowledgeLibraryRecordStatus,
} from "./entities.js";

export interface KnowledgeLibraryRecordListFilter {
  readonly sourceType?: string;
  readonly status?: KnowledgeLibraryRecordStatus;
  readonly confidentiality?: KnowledgeLibraryRecordConfidentiality;
  readonly approvedForAgentUse?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

/** Every field a caller may set/change at create time, i.e. `KnowledgeLibraryRecordEntity` minus
 *  its server-only-managed columns (`id`, `status`, `version`, `createdAt`, `updatedAt`). */
type KnowledgeLibraryContentFields = Omit<
  KnowledgeLibraryRecordEntity,
  "id" | "status" | "version" | "createdAt" | "updatedAt"
>;

/** `create()`/`update()`'s own field shape: every content field is optional; `relatedEntityIds`
 *  additionally accepts an explicit `null` (equivalent to omitting it on `create()`; clears it on
 *  `update()`) — mirrors `PersonaRepository`'s own array-clearing convention for a NOT NULL array
 *  column. */
type KnowledgeLibraryWritableFields = Omit<
  Partial<KnowledgeLibraryContentFields>,
  "relatedEntityIds"
> & {
  readonly relatedEntityIds?: readonly string[] | null;
};

export type UpdateKnowledgeLibraryRecordStatusResult =
  | { readonly outcome: "updated"; readonly entity: KnowledgeLibraryRecordEntity }
  | { readonly outcome: "not_found" }
  | { readonly outcome: "conflict"; readonly entity: KnowledgeLibraryRecordEntity };

// Mirrors BusinessKnowledgeRecordRepository's own DEFAULT_LIST_LIMIT/MAX_LIST_LIMIT clamping
// pattern.
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/** No `projectId` scoping anywhere here — this module's records are organization-wide, not tied
 *  to a `projects` row (per the scope doc). */
export class KnowledgeLibraryRecordRepository {
  private readonly model = getKnowledgeLibraryModels().KnowledgeLibraryRecord;

  async create(
    input: KnowledgeLibraryWritableFields &
      Pick<KnowledgeLibraryContentFields, "title"> & { createdBy?: string | null },
  ): Promise<KnowledgeLibraryRecordEntity> {
    const instance = await this.model.create({
      title: input.title,
      sourceType: input.sourceType ?? null,
      location: input.location ?? null,
      ownerUserId: input.ownerUserId ?? null,
      sourceDate: input.sourceDate ?? null,
      confidentiality: input.confidentiality ?? "public",
      approvedForAgentUse: input.approvedForAgentUse ?? false,
      notes: input.notes ?? null,
      relatedEntityIds: input.relatedEntityIds ?? [],
      lastReviewedAt: input.lastReviewedAt ?? null,
      status: "draft",
      version: 1,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    });
    return toEntityWithIsoDates<KnowledgeLibraryRecordEntity>(instance);
  }

  async findById(id: string): Promise<KnowledgeLibraryRecordEntity | null> {
    const instance = await this.model.findByPk(id);
    return instance ? toEntityWithIsoDates<KnowledgeLibraryRecordEntity>(instance) : null;
  }

  async list(
    filter: KnowledgeLibraryRecordListFilter = {},
  ): Promise<readonly KnowledgeLibraryRecordEntity[]> {
    const where: Record<string, unknown> = {};
    if (filter.sourceType) {
      // Exact match, not a fuzzy `ILIKE` search — `sourceType` is a plain free-text field (D4),
      // and a "filter" on an unstructured field is only meaningful as an exact-value match
      // (e.g. filtering to every record whose sourceType is literally "internal_wiki"), not a
      // substring search (which `title`'s own trigram index exists for, not this field).
      where.sourceType = filter.sourceType;
    }
    if (filter.status) {
      where.status = filter.status;
    }
    if (filter.confidentiality) {
      where.confidentiality = filter.confidentiality;
    }
    if (filter.approvedForAgentUse !== undefined) {
      where.approvedForAgentUse = filter.approvedForAgentUse;
    }
    const limit = Math.min(filter.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const rows = await this.model.findAll({
      where,
      // `id` is a secondary sort key so ties on `updatedAt` don't shift order between two
      // separate paginated queries (matches PersonaRepository.list()'s own precedent).
      order: [
        ["updatedAt", "DESC"],
        ["id", "ASC"],
      ],
      limit,
      offset: filter.offset ?? 0,
    });
    return rows.map((row) => toEntityWithIsoDates<KnowledgeLibraryRecordEntity>(row));
  }

  /**
   * Content update — `status` is deliberately never accepted here (only `updateStatus()` may
   * change it). `version` is server-managed: incremented by 1 as part of the same `UPDATE`
   * statement via a Postgres-evaluated `version + 1` literal, avoiding a read-then-write race
   * (mirrors `PersonaRepository.update()`'s own already-reviewed pattern exactly), and
   * `returning: true` gets the post-update row (including the server-computed `version`) back
   * from the `UPDATE` itself rather than a second round trip.
   */
  async update(
    id: string,
    patch: KnowledgeLibraryWritableFields,
  ): Promise<KnowledgeLibraryRecordEntity | null> {
    const normalized: Record<string, unknown> = { ...patch };
    // `relatedEntityIds` is a NOT NULL array column — an explicit `null` in the patch means
    // "clear to empty", not "store null"; `undefined` (the key omitted entirely) leaves the
    // column unchanged.
    if (patch.relatedEntityIds !== undefined) {
      normalized.relatedEntityIds = patch.relatedEntityIds ?? [];
    }

    const [affectedCount, affectedRows] = await this.model.update(
      { ...normalized, version: literal("version + 1") },
      { where: { id }, returning: true },
    );
    if (affectedCount === 0 || !affectedRows[0]) {
      return null;
    }
    return toEntityWithIsoDates<KnowledgeLibraryRecordEntity>(affectedRows[0]);
  }

  /** Atomic compare-and-swap on `(id, status)` — mirrors `PersonaRepository.updateStatus()`'s own
   *  conditional-`UPDATE` pattern exactly, itself mirroring
   *  `IdempotencyKeyRepository.reserve()`. Does not touch `version` — only content edits via
   *  `update()` increment it. */
  async updateStatus(
    id: string,
    expectedCurrentStatus: KnowledgeLibraryRecordStatus,
    nextStatus: KnowledgeLibraryRecordStatus,
    updatedBy: string | null,
  ): Promise<UpdateKnowledgeLibraryRecordStatusResult> {
    const [affectedCount, affectedRows] = await this.model.update(
      { status: nextStatus, updatedBy },
      { where: { id, status: expectedCurrentStatus }, returning: true },
    );
    if (affectedCount > 0 && affectedRows[0]) {
      return {
        outcome: "updated",
        entity: toEntityWithIsoDates<KnowledgeLibraryRecordEntity>(affectedRows[0]),
      };
    }
    const current = await this.model.findOne({ where: { id } });
    if (!current) {
      return { outcome: "not_found" };
    }
    return {
      outcome: "conflict",
      entity: toEntityWithIsoDates<KnowledgeLibraryRecordEntity>(current),
    };
  }
}
